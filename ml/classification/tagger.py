import os
import sys
import json
import re
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime

import joblib

# Ensure root e-library directory is in sys.path
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

try:
    from ml.ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose
except ImportError:
    from ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose

# ------------------------------------------------------------
# Attempt to load the trained genre classifier when the module is imported.
# ------------------------------------------------------------
_MODEL_PATH = Path(__file__).parent / "genre_classifier.joblib"
_LABELS_PATH = Path(__file__).parent / "genre_labels.json"

try:
    _genre_clf = joblib.load(_MODEL_PATH) if _MODEL_PATH.is_file() else None
    with open(_LABELS_PATH, "r", encoding="utf8") as f:
        _genre_labels = json.load(f)
except Exception:
    _genre_clf = None
    _genre_labels = []

# ------------------------------------------------------------
# Helper: clean text – same as previous implementation
# ------------------------------------------------------------
def clean_text(text: str) -> str:
    """Normalize text by stripping non‑alphanumeric characters and lower‑casing."""
    text = re.sub(r"[^a-zA-Z\s\-]", " ", text.lower())
    text = re.sub(r"\s+", " ", text).strip()
    return text

# ------------------------------------------------------------
# Main public function used by the API endpoint
# ------------------------------------------------------------
def suggest_tags_for_book(
    title: str,
    description: Optional[str] = "",
    chapters_content: Optional[List[str]] = None,
    existing_tags: Optional[List[str]] = None,
    max_suggestions: int = 8,
) -> Dict[str, Any]:
    """Return genre/tag suggestions for a book.

    The function first tries to use a trained genre classifier (if available).
    The classifier receives a handcrafted document consisting of the title,
    description and a sample of the manuscript. If the model is missing or fails,
    the taxonomy logic is executed as a graceful fallback.
    """
    logger = get_ml_logger("classification")
    if chapters_content is None:
        chapters_content = []
    if existing_tags is None:
        existing_tags = []

    logger.info(format_header("GENRE TAGGER INFERENCE"))
    logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Input Title: '{title}' | Synopsis Length: {len(description or '')} chars | Chapters: {len(chapters_content)}")

    # --------------------------------------------------------
    # 1. Try trained model
    # --------------------------------------------------------
    if _genre_clf is not None:
        # Build a minimal document – title weighted heavily, then description, then a short prose sample
        title_text = (title + " ") * 5
        desc_text = ((description or "") + " ") * 3
        prose_sample = " ".join(chapters_content[:5])  # take up to 5 chapters for speed
        doc = f"{title_text} {desc_text} {prose_sample}".strip()
        cleaned = clean_text(doc)
        try:
            pred = _genre_clf.predict([cleaned])[0]
            # Confidence via predict_proba if available
            if hasattr(_genre_clf, "predict_proba"):
                prob = max(_genre_clf.predict_proba([cleaned])[0])
            else:
                prob = 0.85
            
            logger.info(f"Inference Mode: Trained Classifier ({_MODEL_PATH.name})")
            logger.info(f"Predicted Genre: '{pred}' | Confidence Score: {prob:.2f}")
            logger.info("Evaluation metrics: Not available during single-sample inference (Reported during model training)")
            logger.info(format_footer())

            # Return the predicted genre as a single suggested tag
            suggestion = {
                "name": str(pred),
                "confidence": round(float(prob), 2),
                "reason": "Predicted by trained genre classifier",
            }
            return {
                "suggested_tags": [suggestion],
                "keywords": [],
                "analysis_summary": f"Machine‑learned genre prediction: {str(pred)} (confidence {float(prob):.2f}).",
            }
        except Exception as exc:
            logger.warning(f"Trained classifier inference encountered an exception ({exc}), falling back to taxonomy.")

    # --------------------------------------------------------
    # 2. Fallback: Rule-based / Taxonomy heuristic
    # --------------------------------------------------------
    logger.info(f"Inference Mode: Heuristic Taxonomy Fallback (Trained model file present: {_MODEL_PATH.is_file()})")
    fallback_genre = "General Fiction"
    if description:
        desc_lower = description.lower()
        if any(w in desc_lower for w in ["fantasy", "magic", "realm", "dragon", "spell"]):
            fallback_genre = "Fantasy"
        elif any(w in desc_lower for w in ["sci-fi", "space", "alien", "galaxy", "future", "cyber"]):
            fallback_genre = "Science Fiction"
        elif any(w in desc_lower for w in ["mystery", "detective", "murder", "clue", "crime"]):
            fallback_genre = "Mystery"
        elif any(w in desc_lower for w in ["romance", "love", "passion", "heart"]):
            fallback_genre = "Romance"

    logger.info(f"Suggested Genre (Fallback): '{fallback_genre}' (Confidence: 0.70)")
    logger.info("Evaluation metrics: Not available during single-sample inference (Reported during model training)")
    logger.info(format_footer())

    return {
        "suggested_tags": [{"name": fallback_genre, "confidence": 0.70, "reason": "Rule-based keyword fallback"}],
        "keywords": [t.strip() for t in title.split() if len(t) > 3][:max_suggestions],
        "analysis_summary": f"Taxonomy fallback analysis: suggested genre '{fallback_genre}'.",
    }
