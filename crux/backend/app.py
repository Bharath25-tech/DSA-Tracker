import os
import time

from flask import Flask, jsonify, request, render_template
from sqlalchemy.exc import OperationalError

from models import db, Topic, Question
from seed_data import SEED_TOPICS

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///crux.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


def wait_for_db_and_init(max_attempts=30, delay_seconds=2):
    """Postgres can take a few seconds to accept connections after container
    start. Retry instead of crashing the whole app on the first attempt."""
    for attempt in range(1, max_attempts + 1):
        try:
            with app.app_context():
                db.create_all()
                seed_if_empty()
            return
        except OperationalError as e:
            print(f"[crux] DB not ready (attempt {attempt}/{max_attempts}): {e}")
            time.sleep(delay_seconds)
    raise RuntimeError("Could not connect to the database after multiple attempts.")


def seed_if_empty():
    if Topic.query.count() > 0:
        return
    for t_pos, topic_data in enumerate(SEED_TOPICS):
        topic = Topic(name=topic_data["name"], position=t_pos)
        db.session.add(topic)
        db.session.flush()  # get topic.id
        for q_pos, (name, number, link, difficulty, technique, hint) in enumerate(
            topic_data["questions"]
        ):
            db.session.add(
                Question(
                    topic_id=topic.id,
                    position=q_pos,
                    name=name,
                    number=number,
                    link=link,
                    difficulty=difficulty,
                    technique=technique,
                    hint=hint,
                )
            )
    db.session.commit()
    print("[crux] Seeded starter routes: Arrays, Strings.")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state")
def get_state():
    topics = Topic.query.order_by(Topic.position).all()
    return jsonify({"topics": [t.to_dict() for t in topics]})


@app.route("/api/topics", methods=["POST"])
def create_topic():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Route name is required."}), 400
    max_pos = db.session.query(db.func.max(Topic.position)).scalar() or 0
    topic = Topic(name=name, position=max_pos + 1)
    db.session.add(topic)
    db.session.commit()
    return jsonify(topic.to_dict()), 201


@app.route("/api/topics/<int:topic_id>/questions", methods=["POST"])
def create_question(topic_id):
    topic = Topic.query.get_or_404(topic_id)
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Pitch name is required."}), 400
    max_pos = (
        db.session.query(db.func.max(Question.position))
        .filter(Question.topic_id == topic_id)
        .scalar()
        or 0
    )
    question = Question(
        topic_id=topic.id,
        position=max_pos + 1,
        name=name,
        number=(data.get("number") or "").strip(),
        link=(data.get("link") or "").strip(),
        difficulty=(data.get("difficulty") or "").strip(),
        technique=(data.get("technique") or "").strip(),
        hint=(data.get("hint") or "").strip(),
    )
    db.session.add(question)
    db.session.commit()
    return jsonify(question.to_dict()), 201


@app.route("/api/questions/<int:question_id>", methods=["PATCH"])
def update_question(question_id):
    question = Question.query.get_or_404(question_id)
    data = request.get_json(force=True) or {}
    if "done" in data:
        question.done = bool(data["done"])
    if "notes" in data:
        question.notes = data["notes"]
    db.session.commit()
    return jsonify(question.to_dict())


@app.route("/api/questions/<int:question_id>", methods=["DELETE"])
def delete_question(question_id):
    question = Question.query.get_or_404(question_id)
    db.session.delete(question)
    db.session.commit()
    return jsonify({"deleted": question_id})


if __name__ == "__main__":
    wait_for_db_and_init()
    app.run(host="0.0.0.0", port=5000)
