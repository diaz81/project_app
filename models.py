from datetime import date, datetime

from flask import url_for
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()

# Manual classification the inspector assigns to a point. Keys are the values
# stored in SQLite and sent over the API; keep in sync with the <select>
# options in templates/inspector.html and static/js/classifications.js.
CLASSIFICATION_CHOICES = {
    "registrado": "🟢 Registrado",
    "observacion": "🟡 Observación",
    "diferencia_significativa": "🟠 Diferencia significativa",
    "evaluacion_adicional": "🔴 Evaluación adicional recomendada",
    "sin_referencia": "⚪ Sin referencia",
}


class Vehicle(db.Model):
    """The physical vehicle being inspected. Created fresh with each new inspection."""

    __tablename__ = "vehicles"

    id = db.Column(db.Integer, primary_key=True)
    brand = db.Column(db.String(100), nullable=False)
    model = db.Column(db.String(100), nullable=False)
    year = db.Column(db.Integer, nullable=True)
    vin = db.Column(db.String(50), nullable=True)
    mileage = db.Column(db.Float, nullable=True)
    plate = db.Column(db.String(20), nullable=False)

    inspections = db.relationship("Inspection", backref="vehicle", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "brand": self.brand,
            "model": self.model,
            "year": self.year,
            "vin": self.vin,
            "mileage": self.mileage,
            "plate": self.plate,
        }


class Inspection(db.Model):
    """One inspection session for a given vehicle. Owns a set of measurement points."""

    __tablename__ = "inspections"

    id = db.Column(db.Integer, primary_key=True)
    vehicle_id = db.Column(db.Integer, db.ForeignKey("vehicles.id"), nullable=False)
    client = db.Column(db.String(150), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    inspector = db.Column(db.String(150), nullable=False)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    points = db.relationship(
        "InspectionPoint", backref="inspection", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "vehicle_id": self.vehicle_id,
            "client": self.client,
            "date": self.date.isoformat() if self.date else None,
            "inspector": self.inspector,
            "notes": self.notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class InspectionPoint(db.Model):
    """A single thickness-measurement point clicked on the 3D vehicle surface."""

    __tablename__ = "inspection_points"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(db.Integer, db.ForeignKey("inspections.id"), nullable=False)

    # Position on the 3D model where the inspector clicked.
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    z = db.Column(db.Float, nullable=False)

    thickness_mm = db.Column(db.Float, nullable=False)
    location = db.Column(db.String(200), nullable=False)
    observation = db.Column(db.Text, nullable=True)
    photo_filename = db.Column(db.String(300), nullable=True)
    classification = db.Column(db.String(50), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "thickness_mm": self.thickness_mm,
            "location": self.location,
            "observation": self.observation,
            "classification": self.classification,
            "photo_url": (
                url_for("static", filename=f"uploads/{self.photo_filename}")
                if self.photo_filename
                else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
