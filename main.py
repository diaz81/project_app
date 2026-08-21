import os
import uuid
from datetime import date, datetime

from flask import Flask, abort, jsonify, redirect, render_template, request, url_for

from models import CLASSIFICATION_CHOICES, Inspection, InspectionPoint, Vehicle, db

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def resolve_database_uri():
    """Uses PostgreSQL when DATABASE_URL is set (Railway in production),
    otherwise falls back to the local SQLite file (local development).
    """
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        return "sqlite:///" + os.path.join(INSTANCE_DIR, "inspections.db")

    # Some providers still hand out the old "postgres://" scheme, which
    # SQLAlchemy 1.4+ no longer accepts — normalize it.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    return database_url


def create_app():
    app = Flask(__name__)

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(INSTANCE_DIR, exist_ok=True)

    app.config["SQLALCHEMY_DATABASE_URI"] = resolve_database_uri()
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    # Guards against stale/dropped connections from a managed DB (e.g. after
    # the connection has been idle) by testing the connection before reuse.
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {"pool_pre_ping": True}
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

    @app.route("/inspections")
    def list_inspections():
        inspections = Inspection.query.order_by(Inspection.created_at.desc()).all()
        return render_template("inspections_list.html", inspections=inspections)

    @app.route("/inspections/new")
    def new_inspection_form():
        return render_template("inspection_new.html")

    @app.route("/inspections", methods=["POST"])
    def create_inspection():
        form = request.form
        brand = (form.get("brand") or "").strip()
        model = (form.get("model") or "").strip()
        vin = (form.get("vin") or "").strip()
        plate = (form.get("plate") or "").strip()
        color = (form.get("color") or "").strip()
        client = (form.get("client") or "").strip()
        inspector_name = (form.get("inspector") or "").strip()
        notes = (form.get("notes") or "").strip()

        errors = []
        if not brand:
            errors.append("La marca es obligatoria.")
        if not model:
            errors.append("El modelo es obligatorio.")
        if not plate:
            errors.append("La patente/placa es obligatoria.")
        if not client:
            errors.append("El cliente es obligatorio.")
        if not inspector_name:
            errors.append("El inspector es obligatorio.")

        year = None
        year_raw = (form.get("year") or "").strip()
        if year_raw:
            try:
                year = int(year_raw)
            except ValueError:
                errors.append("El año debe ser un número.")

        mileage = None
        mileage_raw = (form.get("mileage") or "").strip()
        if mileage_raw:
            try:
                mileage = float(mileage_raw)
            except ValueError:
                errors.append("El kilometraje debe ser un número.")

        insp_date = date.today()
        date_raw = (form.get("date") or "").strip()
        if date_raw:
            try:
                insp_date = datetime.strptime(date_raw, "%Y-%m-%d").date()
            except ValueError:
                errors.append("La fecha no es válida.")

        if errors:
            return render_template("inspection_new.html", errors=errors, form=form), 400

        vehicle = Vehicle(
            brand=brand,
            model=model,
            year=year,
            vin=vin or None,
            mileage=mileage,
            plate=plate,
            color=color or None,
        )
        db.session.add(vehicle)
        db.session.flush()  # assign vehicle.id before creating the inspection

        inspection = Inspection(
            vehicle_id=vehicle.id,
            client=client,
            date=insp_date,
            inspector=inspector_name,
            notes=notes,
        )
        db.session.add(inspection)
        db.session.commit()

        return redirect(url_for("inspector", inspection_id=inspection.id))

    @app.route("/inspector")
    def inspector():
        inspection = _get_inspection_or_none(request.args.get("inspection_id", type=int))
        if inspection is None:
            return redirect(url_for("list_inspections"))
        return render_template("inspector.html", inspection=inspection, vehicle=inspection.vehicle)

    @app.route("/client")
    def client():
        inspection = _get_inspection_or_none(request.args.get("inspection_id", type=int))
        if inspection is None:
            return redirect(url_for("list_inspections"))
        return render_template("client.html", inspection=inspection, vehicle=inspection.vehicle)

    def _get_inspection_or_none(inspection_id):
        if not inspection_id:
            return None
        return Inspection.query.get(inspection_id)

    @app.route("/api/points", methods=["GET"])
    def list_points():
        inspection_id = request.args.get("inspection_id", type=int)
        query = InspectionPoint.query
        if inspection_id:
            query = query.filter_by(inspection_id=inspection_id)
        points = query.order_by(InspectionPoint.id).all()
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
            inspection_id = int(form["inspection_id"])
        except (KeyError, ValueError):
            return jsonify({"error": "Coordenadas, espesor o inspección inválidos."}), 400

        if Inspection.query.get(inspection_id) is None:
            return jsonify({"error": "La inspección indicada no existe."}), 400

        location = (form.get("location") or "").strip()
        observation = (form.get("observation") or "").strip()
        classification = (form.get("classification") or "").strip()
        if not location:
            return jsonify({"error": "La ubicación es obligatoria."}), 400
        if thickness < 0:
            return jsonify({"error": "El espesor no puede ser negativo."}), 400
        if classification not in CLASSIFICATION_CHOICES:
            return jsonify({"error": "Selecciona una clasificación válida."}), 400

        photo_filename = None
        file = request.files.get("photo")
        if file and file.filename:
            if not allowed_file(file.filename):
                return jsonify({"error": "Formato de imagen no permitido."}), 400
            ext = file.filename.rsplit(".", 1)[1].lower()
            photo_filename = f"{uuid.uuid4().hex}.{ext}"
            file.save(os.path.join(app.config["UPLOAD_FOLDER"], photo_filename))

        point = InspectionPoint(
            inspection_id=inspection_id,
            x=x,
            y=y,
            z=z,
            thickness_mm=thickness,
            location=location,
            observation=observation,
            classification=classification,
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
