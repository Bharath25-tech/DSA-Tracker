from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Topic(db.Model):
    __tablename__ = "topics"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)

    questions = db.relationship(
        "Question",
        backref="topic",
        order_by="Question.position",
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        total = len(self.questions)
        done = sum(1 for q in self.questions if q.done)
        return {
            "id": self.id,
            "name": self.name,
            "position": self.position,
            "total": total,
            "done": done,
            "questions": [q.to_dict() for q in self.questions],
        }


class Question(db.Model):
    __tablename__ = "questions"

    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey("topics.id"), nullable=False)
    position = db.Column(db.Integer, nullable=False, default=0)

    name = db.Column(db.String(200), nullable=False)
    number = db.Column(db.String(20), default="")
    link = db.Column(db.String(500), default="")
    difficulty = db.Column(db.String(10), default="")  # Easy / Medium / Hard
    technique = db.Column(db.String(80), default="")   # short strategy tag
    hint = db.Column(db.Text, default="")               # "beta" — suggested approach
    notes = db.Column(db.Text, default="")               # user's own field notes
    done = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def to_dict(self):
        return {
            "id": self.id,
            "topic_id": self.topic_id,
            "position": self.position,
            "name": self.name,
            "number": self.number or "",
            "link": self.link or "",
            "difficulty": self.difficulty or "",
            "technique": self.technique or "",
            "hint": self.hint or "",
            "notes": self.notes or "",
            "done": self.done,
        }
