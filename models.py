from datetime import datetime

from flask import url_for
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class InspectionPoint(db.Model):
    """A single thickness-measurement point clicked on the 3D vehicle surface."""

    __tablename__ = "inspection_points"

    id = db.Column(db.Integer, primary_key=True)

    # Position on the 3D model where the inspector clicked.
    x = db.Column(db.Float, nullable=False)
    y = db.Column(db.Float, nullable=False)
    z = db.Column(db.Float, nullable=False)

    thickness_mm = db.Column(db.Float, nullable=False)
    location = db.Column(db.String(200), nullable=False)
    observation = db.Column(db.Text, nullable=True)
    photo_filename = db.Column(db.String(300), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "x": self.x,
            "y": self.y,
            "z": self.z,
            "thickness_mm": self.thickness_mm,
            "location": self.location,
            "observation": self.observation,
            "photo_url": (
                url_for("static", filename=f"uploads/{self.photo_filename}")
                if self.photo_filename
                else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
