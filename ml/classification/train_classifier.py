"""
Training script for book genre classification using the CMU Book Summary Dataset.
The script downloads the dataset (if not present), extracts it, loads the summaries
and genre metadata, builds a TF‑IDF + LogisticRegression pipeline, evaluates on a
held‑out test split, and saves the fitted pipeline and label mapping to disk.
"""

import os
import sys
import tarfile
import urllib.request
import json
import random
import time
from datetime import datetime
import pathlib
from pathlib import Path
import joblib
from collections import Counter
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    classification_report,
    f1_score,
    accuracy_score,
    precision_recall_fscore_support,
    confusion_matrix,
)

# Ensure root e-library directory is in sys.path
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

try:
    from ml.ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose
except ImportError:
    from ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATA_URL = "http://www.cs.cmu.edu/~dbamman/data/booksummaries.tar.gz"
DATA_ARCHIVE = Path(__file__).parent / "booksummaries.tar.gz"
EXTRACT_DIR = Path(__file__).parent / "booksummaries"
MODEL_PATH = Path(__file__).parent / "genre_classifier.joblib"
LABELS_PATH = Path(__file__).parent / "genre_labels.json"
METRICS_PATH = Path(__file__).parent / "genre_metrics.json"
RANDOM_SEED = 42

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------
def download_dataset():
    """Download the CMU dataset if it does not already exist."""
    if DATA_ARCHIVE.is_file():
        print(f"Dataset archive already present at {DATA_ARCHIVE}")
        return
    print(f"Downloading CMU Book Summary dataset from {DATA_URL} ...")
    urllib.request.urlretrieve(DATA_URL, DATA_ARCHIVE)
    print("Download completed.")

def extract_dataset():
    """Extract the tar.gz archive into EXTRACT_DIR if not already extracted."""
    if EXTRACT_DIR.is_dir():
        print(f"Dataset already extracted to {EXTRACT_DIR}")
        return
    print(f"Extracting {DATA_ARCHIVE} ...")
    with tarfile.open(DATA_ARCHIVE, "r:gz") as tar:
        tar.extractall(path=EXTRACT_DIR)
    print("Extraction completed.")

def load_data():
    """Load books summaries and genre labels.

    The extracted archive may contain either a JSON lines file ("booksummaries.json")
    or a tab‑separated text file ("booksummaries.txt").  Each line of the TXT file has the
    following fields (tab‑separated):
        id, freebase_id, title, author, year, genre_json, summary

    The ``genre_json`` column is a JSON object mapping freebase genre IDs to genre names.
    We treat the task as multi‑class by taking the first genre name listed.
    """
    # Prefer the JSON file if it exists
    json_path = EXTRACT_DIR / "booksummaries" / "booksummaries.json"
    txt_path = EXTRACT_DIR / "booksummaries" / "booksummaries.txt"
    if json_path.is_file():
        path = json_path
        is_json = True
    elif txt_path.is_file():
        path = txt_path
        is_json = False
    else:
        raise FileNotFoundError(f"Unable to locate booksummaries.json or booksummaries.txt in {EXTRACT_DIR}")

    texts = []
    labels = []
    if is_json:
        with open(path, "r", encoding="utf8") as f:
            for line in f:
                try:
                    entry = json.loads(line)
                    doc = f"{entry.get('title','')} {entry.get('summary','')}"
                    genre_list = entry.get('genre', [])
                    if not genre_list:
                        continue
                    label = genre_list[0].lower()
                    texts.append(doc)
                    labels.append(label)
                except json.JSONDecodeError:
                    continue
    else:
        # TXT format: tab‑separated, with a JSON dict in the genre column
        with open(path, "r", encoding="utf8") as f:
            for line in f:
                parts = line.strip().split("\t")
                if len(parts) < 7:
                    continue
                _, _, title, _, _, genre_json, summary = parts[:7]
                try:
                    genre_dict = json.loads(genre_json)
                except json.JSONDecodeError:
                    continue
                if not genre_dict:
                    continue
                # Take the first genre name (values of the dict)
                label = next(iter(genre_dict.values())).lower()
                doc = f"{title} {summary}"
                texts.append(doc)
                labels.append(label)
    return texts, labels

def train_and_evaluate(texts, labels):
    logger = get_ml_logger("classification")
    logger.info(format_header("SUPERVISED GENRE CLASSIFIER — TRAINING & EVALUATION"))
    
    total_samples = len(texts)
    class_counts = Counter(labels)
    unique_classes = sorted(class_counts.keys())
    
    logger.info(f"Dataset Size: {total_samples} labeled book summaries")
    logger.info(f"Number of Unique Genre Classes: {len(unique_classes)}")
    
    # Class distribution
    top_5 = class_counts.most_common(5)
    top_str = ", ".join([f"'{c}': {cnt} ({round(cnt/total_samples*100, 1)}%)" for c, cnt in top_5])
    logger.info(f"Top Class Distribution: {top_str}")

    X_train, X_test, y_train, y_test = train_test_split(
        texts, labels, test_size=0.2, random_state=RANDOM_SEED, stratify=labels
    )
    logger.info(f"Train/Test Split: {len(X_train)} training samples (80%), {len(X_test)} evaluation samples (20%)")

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(stop_words="english", max_features=20000, ngram_range=(1,2))),
        ("clf", LogisticRegression(max_iter=1000, n_jobs=-1, class_weight="balanced")),
    ])

    train_start = time.time()
    train_start_dt = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    logger.info(f"Training Started: {train_start_dt}")
    logger.info("Fitting TF-IDF Vectorizer (ngram=(1,2), max_features=20000) and LogisticRegression (class_weight='balanced')...")

    try:
        pipeline.fit(X_train, y_train)
        train_duration = time.time() - train_start
        train_end_dt = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        logger.info(f"Training Completed: {train_end_dt} (Duration: {train_duration:.2f} seconds)")
    except Exception as err:
        logger.error(f"Training Failed with error: {err}")
        logger.info(format_footer())
        raise

    eval_start = time.time()
    logger.info("Evaluating on held-out test split...")
    y_pred = pipeline.predict(X_test)
    eval_duration = time.time() - eval_start

    # Exact Metrics calculated on real test split
    accuracy = accuracy_score(y_test, y_pred)
    macro_precision, macro_recall, macro_f1, _ = precision_recall_fscore_support(y_test, y_pred, average="macro", zero_division=0)
    weighted_precision, weighted_recall, weighted_f1, _ = precision_recall_fscore_support(y_test, y_pred, average="weighted", zero_division=0)
    report = classification_report(y_test, y_pred, digits=3, zero_division=0)

    logger.info(f"Evaluation Completed in {eval_duration:.3f} seconds")
    logger.info(f"Test Accuracy: {accuracy:.4f}")
    logger.info(f"Macro Averages: Precision={macro_precision:.4f}, Recall={macro_recall:.4f}, F1={macro_f1:.4f}")
    logger.info(f"Weighted Averages: Precision={weighted_precision:.4f}, Recall={weighted_recall:.4f}, F1={weighted_f1:.4f}")
    logger.info("\n--- Per-Class Classification Report ---\n" + report)

    # Confusion matrix where practical (top 5 classes)
    try:
        top_classes = [c for c, _ in class_counts.most_common(5)]
        cm = confusion_matrix(y_test, y_pred, labels=top_classes)
        logger.info(f"Confusion Matrix (Top {len(top_classes)} classes: {top_classes}):\n{cm}")
    except Exception as cm_err:
        logger.info(f"Confusion Matrix not displayed: {cm_err}")

    # Historical Comparison if previous metrics file exists
    logger.info("--- Retraining & Historical Comparison ---")
    if METRICS_PATH.is_file():
        try:
            with open(METRICS_PATH, "r", encoding="utf8") as f:
                prev_metrics = json.load(f)
            prev_f1 = prev_metrics.get("macro_f1", 0.0)
            prev_acc = prev_metrics.get("accuracy", 0.0)
            f1_diff = macro_f1 - prev_f1
            acc_diff = accuracy - prev_acc
            logger.info(
                f"Previous Training Run: {prev_metrics.get('timestamp', 'N/A')}\n"
                f"  Macro-F1: {prev_f1:.4f} -> Current: {macro_f1:.4f} (Delta: {f1_diff:+.4f})\n"
                f"  Accuracy: {prev_acc:.4f} -> Current: {accuracy:.4f} (Delta: {acc_diff:+.4f})"
            )
        except Exception as e:
            logger.warning(f"Could not parse previous metrics file: {e}")
    else:
        logger.info("No previous training metrics found on disk. Setting current metrics as baseline.")

    # Save metrics record
    new_metrics = {
        "timestamp": datetime.now().isoformat(),
        "dataset_size": total_samples,
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "accuracy": round(float(accuracy), 4),
        "macro_precision": round(float(macro_precision), 4),
        "macro_recall": round(float(macro_recall), 4),
        "macro_f1": round(float(macro_f1), 4),
        "weighted_precision": round(float(weighted_precision), 4),
        "weighted_recall": round(float(weighted_recall), 4),
        "weighted_f1": round(float(weighted_f1), 4),
        "train_duration_sec": round(train_duration, 2),
        "eval_duration_sec": round(eval_duration, 3)
    }
    with open(METRICS_PATH, "w", encoding="utf8") as f:
        json.dump(new_metrics, f, indent=2)

    logger.info(f"Model Artifact Save Location: {MODEL_PATH}")
    logger.info(f"Labels Save Location: {LABELS_PATH}")
    logger.info(f"Metrics Record Save Location: {METRICS_PATH}")
    logger.info(format_footer())

    return pipeline, macro_f1, report

def save_artifacts(pipeline, labels):
    joblib.dump(pipeline, MODEL_PATH)
    unique_labels = sorted(set(labels))
    with open(LABELS_PATH, "w", encoding="utf8") as f:
        json.dump(unique_labels, f, ensure_ascii=False, indent=2)

def main():
    random.seed(RANDOM_SEED)
    download_dataset()
    extract_dataset()
    # Load data
    texts, labels = load_data()
    # Filter out classes with too few samples (need at least 2 for stratified split)
    from collections import Counter
    label_counts = Counter(labels)
    filtered = [(t, l) for t, l in zip(texts, labels) if label_counts[l] >= 2]
    if not filtered:
        raise RuntimeError("No classes have enough samples for training after filtering.")
    texts, labels = zip(*filtered)
    texts = list(texts)
    labels = list(labels)
    # Train and evaluate
    pipeline, macro_f1, report = train_and_evaluate(texts, labels)
    # Save model and label mapping
    save_artifacts(pipeline, labels)
    print(f"Training completed. Macro-F1 = {macro_f1:.4f}")

if __name__ == "__main__":
    main()
