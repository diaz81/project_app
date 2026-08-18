import os
import uuid

from flask import Flask, abort, jsonify, render_template, request

from models import InspectionPoint, db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def create_app():
    app = Flask(__name__)

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(INSTANCE_DIR, exist_ok=True)

    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///" + os.path.join(
        INSTANCE_DIR, "inspections.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
    app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB

    db.init_app(app)
    with app.app_context():
        db.create_all()

    register_routes(app)
    register_error_handlers(app)
    return app


def register_routes(app):
    @app.route("/")
    def index():
        return render_template("index.html")

    @app.route("/inspector")
    def inspector():
        return render_template("inspector.html")

    @app.route("/client")
    def client():
        return render_template("client.html")

    @app.route("/api/points", methods=["GET"])
    def list_points():
        points = InspectionPoint.query.order_by(InspectionPoint.id).all()
        return jsonify([p.to_dict() for p in points])

    @app.route("/api/points/<int:point_id>", methods=["GET"])
    def get_point(point_id):
        point = InspectionPoint.query.get_or_404(point_id)
        return jsonify(point.to_dict())

    @app.route("/api/points", methods=["POST"])
    def create_point():
        form = request.form
        try:
            x = float(form["x"])
            y = float(form["y"])
            z = float(form["z"])
            thickness = float(form["thickness"])
        except (KeyError, ValueError):
            return jsonify({"error": "Coordenadas o espesor inválidos."}), 400

        location = (form.get("location") or "").strip()
        observation = (form.get("observation") or "").strip()
        if not location:
            return jsonify({"error": "La ubicación es obligatoria."}), 400
        if thickness < 0:
            return jsonify({"error": "El espesor no puede ser negativo."}), 400

        photo_filename = None
        file = request.files.get("photo")
        if file and file.filename:
            if not allowed_file(file.filename):
                return jsonify({"error": "Formato de imagen no permitido."}), 400
            ext = file.filename.rsplit(".", 1)[1].lower()
            photo_filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], photo_filename))

        point = InspectionPoint(
            x=x,
            y=y,
            z=z,
            thickness_mm=thickness,
            location=location,
            observation=observation,
            photo_filename=photo_filename,
        )
        db.session.add(point)
        db.session.commit()
        return jsonify(point.to_dict()), 201

    @app.route("/api/points/<int:point_id>", methods=["DELETE"])
    def delete_point(point_id):
        point = InspectionPoint.query.get_or_404(point_id)
        if point.photo_filename:
            path = os.path.join(app.config["UPLOAD_FOLDER"], point.photo_filename)
            try:
                if os.path.exists(path):
                    os.remove(path)
            except OSError:
                # Best-effort cleanup: don't fail the deletion if the file
                # is locked (e.g. still being read) or already gone.
                app.logger.warning("No se pudo borrar el archivo de foto: %s", path)
        db.session.delete(point)
        db.session.commit()
        return "", 204


def register_error_handlers(app):
    @app.errorhandler(404)
    def not_found(e):
        if request.path.startswith("/api/"):
            return jsonify({"error": "No encontrado."}), 404
        return e, 404

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "El archivo es demasiado grande (máx. 8MB)."}), 413


app = create_app()

if __name__ == "__main__":
    app.run(debug=True)
