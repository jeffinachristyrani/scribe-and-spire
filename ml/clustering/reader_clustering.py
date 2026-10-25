"""
Reader Habit Clustering Engine using K-Means
Clusters users based on reading frequency, progress percentage, completion habits,
bookmarking engagement, review tendencies, and genre affinities.
Follows ML best practices: feature scaling, missing value handling, and archetype labeling.
"""

import os
import sys
from typing import List, Dict, Any, Tuple
from datetime import datetime
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Ensure root e-library directory is in sys.path
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

try:
    from ml.ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose
except ImportError:
    from ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose

# Global state tracker for cluster-state comparison between runs
_PREVIOUS_USER_ASSIGNMENTS: Dict[int, str] = {}

GENRE_KEYS = ["fantasy", "sci-fi", "mystery", "thriller", "romance", "horror", "general"]


def build_reader_feature_vector(user_activity: Dict[str, Any]) -> List[float]:
    """
    Constructs an 11-dimensional numerical habit feature vector for a reader:
    [
      total_sessions,
      avg_progress_pct,
      completed_books,
      bookmarks_count,
      reviews_count,
      avg_rating_given,
      fantasy_share,
      scifi_share,
      mystery_share,
      romance_share,
      general_share
    ]
    """
    total_sessions = float(user_activity.get("total_sessions", 0))
    avg_progress = float(user_activity.get("avg_progress_pct", 0.0))
    completed_books = float(user_activity.get("completed_books", 0))
    bookmarks_count = float(user_activity.get("bookmarks_count", 0))
    reviews_count = float(user_activity.get("reviews_count", 0))
    
    # Impute neutral rating 3.0 if user has left no reviews
    avg_rating = float(user_activity.get("avg_rating", 3.0)) if reviews_count > 0 else 3.0

    genre_counts = user_activity.get("genre_counts", {})
    total_genre_reads = max(1.0, sum(genre_counts.values()))

    genre_shares = [
        genre_counts.get("fantasy", 0.0) / total_genre_reads,
        genre_counts.get("sci-fi", 0.0) / total_genre_reads,
        genre_counts.get("mystery", 0.0) / total_genre_reads,
        genre_counts.get("thriller", 0.0) / total_genre_reads,
        genre_counts.get("romance", 0.0) / total_genre_reads,
    ]

    return [
        total_sessions,
        avg_progress,
        completed_books,
        bookmarks_count,
        reviews_count,
        avg_rating,
        *genre_shares
    ]


def derive_persona_profile(center: np.ndarray, feature_names: List[str]) -> Tuple[str, str]:
    """
    Assigns intuitive literary persona labels and narrative descriptions based
    on cluster center centroids.
    """
    # [total_sessions, avg_progress, completed_books, bookmarks_count, reviews_count, avg_rating, ...]
    sessions = center[0]
    avg_progress = center[1]
    completed = center[2]
    bookmarks = center[3]
    reviews = center[4]
    avg_rating = center[5]

    if completed >= 1.5 or avg_progress >= 70:
        return (
            "Devoted Completers",
            "Immersive readers who faithfully follow books to their final chapters and maintain high reading progress."
        )
    elif reviews >= 1.5 or (reviews >= 1 and sessions > 3):
        return (
            "Literary Critics & Reviewers",
            "Articulate readers who actively share ratings, reflections, and feedback on character arcs and prose."
        )
    elif bookmarks >= 2 or sessions >= 5:
        return (
            "Avid Serial Voyagers",
            "Frequent readers who regularly bookmark favorite chapters and follow ongoing serialized manuscripts."
        )
    elif avg_progress <= 35 and sessions <= 2:
        return (
            "Curious Explorers",
            "Readers who browse diverse literary catalogs, sampling opening chapters to discover new authors."
        )
    else:
        return (
            "Casual Story Seekers",
            "Balanced leisure readers who enjoy engaging narrative storytelling at their own relaxed pace."
        )


def cluster_readers(users_data: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Executes K-Means clustering across reader habit vectors.
    Returns:
      - cluster assignments per user
      - cluster personas and centroids
      - scaled feature representations for downstream KNN recommendations
    Logs structured clustering diagnostics and cluster-state transitions to console.
    """
    global _PREVIOUS_USER_ASSIGNMENTS
    logger = get_ml_logger("clustering")
    num_users = len(users_data)

    if num_users == 0:
        logger.info(format_header("K-MEANS READER HABIT CLUSTERING"))
        logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("Number of Readers: 0 (No active reader interaction profiles).")
        logger.info("Accuracy / Precision / Recall / F1: Not available — unsupervised clustering without external ground-truth labels")
        logger.info(format_footer())
        return {
            "cluster_count": 0,
            "user_assignments": {},
            "cluster_personas": {},
            "feature_matrix": np.empty((0, 11)),
            "user_ids": []
        }

    user_ids = [u["user_id"] for u in users_data]
    raw_matrix = np.array([build_reader_feature_vector(u) for u in users_data], dtype=np.float64)

    # Standardize numerical features
    scaler = StandardScaler()
    scaled_matrix = scaler.fit_transform(raw_matrix)

    # Determine adaptive K
    if num_users >= 8:
        k = 4
    elif num_users >= 4:
        k = 3
    elif num_users >= 2:
        k = 2
    else:
        k = 1

    kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
    labels = kmeans.fit_predict(scaled_matrix)

    # Map cluster centroids back to unscaled space for interpretability
    centroids_unscaled = scaler.inverse_transform(kmeans.cluster_centers_)

    cluster_personas = {}
    for cluster_idx in range(k):
        name, desc = derive_persona_profile(centroids_unscaled[cluster_idx], [])
        cluster_personas[cluster_idx] = {
            "name": name,
            "description": desc,
            "member_count": int(np.sum(labels == cluster_idx)),
            "avg_progress": round(float(centroids_unscaled[cluster_idx][1]), 1),
            "avg_sessions": round(float(centroids_unscaled[cluster_idx][0]), 1)
        }

    user_assignments = {}
    for i, uid in enumerate(user_ids):
        c_id = int(labels[i])
        user_assignments[uid] = {
            "cluster_id": c_id,
            "persona_name": cluster_personas[c_id]["name"],
            "persona_description": cluster_personas[c_id]["description"]
        }

    # Clustering Diagnostics
    inertia = round(float(kmeans.inertia_), 4)
    silhouette = "N/A (< 2 clusters or < 3 samples)"
    if k > 1 and num_users > k:
        try:
            from sklearn.metrics import silhouette_score
            silhouette = f"{float(silhouette_score(scaled_matrix, labels)):.4f}"
        except Exception:
            silhouette = "Calculation error"

    # Structured ML Console Logging
    logger.info(format_header("K-MEANS READER HABIT CLUSTERING"))
    logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Reader Profiles: {num_users} readers analyzed")
    logger.info(f"Feature Matrix Shape: {raw_matrix.shape} (11 dimensions: sessions, progress, completion, bookmarks, reviews, rating, 5 genre shares)")
    logger.info(f"Selected Number of Clusters (k): {k}")
    logger.info(f"Clustering Diagnostics: Inertia = {inertia} | Silhouette Score = {silhouette}")

    logger.info("--- Derived Literary Personas & Centroids ---")
    for cluster_idx in range(k):
        cp = cluster_personas[cluster_idx]
        centroid = centroids_unscaled[cluster_idx]
        logger.info(
            f"  Cluster {cluster_idx} [{cp['name']}]: {cp['member_count']} members ({round(cp['member_count']/num_users*100, 1)}%)\n"
            f"    Description: {cp['description']}\n"
            f"    Centroid (Unscaled): Sessions={centroid[0]:.1f}, AvgProgress={centroid[1]:.1f}%, "
            f"Completed={centroid[2]:.1f}, Bookmarks={centroid[3]:.1f}, Reviews={centroid[4]:.1f}, Rating={centroid[5]:.2f}"
        )

    if is_ml_verbose():
        logger.info("--- Reader Cluster Assignments ---")
        for uid in user_ids:
            assn = user_assignments[uid]
            logger.info(f"  Reader ID {uid} -> Cluster {assn['cluster_id']} ({assn['persona_name']})")

    # Cluster-State Comparison Tracking
    logger.info("--- Cluster State Transition Comparison ---")
    if not _PREVIOUS_USER_ASSIGNMENTS:
        logger.info(f"No previous cluster state exists (initial clustering run). Registered baseline archetypes for {len(user_assignments)} readers.")
    else:
        transitions = []
        stable_count = 0
        new_count = 0
        for uid, assn in user_assignments.items():
            current_persona = assn["persona_name"]
            if uid not in _PREVIOUS_USER_ASSIGNMENTS:
                new_count += 1
                transitions.append(f"  Reader ID {uid}: New reader assigned to '{current_persona}'")
            else:
                prev_persona = _PREVIOUS_USER_ASSIGNMENTS[uid]
                if prev_persona != current_persona:
                    transitions.append(f"  Reader ID {uid}: Transitioned from '{prev_persona}' -> '{current_persona}'")
                else:
                    stable_count += 1
                    if is_ml_verbose():
                        transitions.append(f"  Reader ID {uid}: Stable in '{current_persona}'")

        if transitions:
            for t in transitions[:15]:
                logger.info(t)
            if len(transitions) > 15:
                logger.info(f"  ... and {len(transitions) - 15} additional reader comparisons.")
        logger.info(f"Transition Summary: {len(user_assignments) - stable_count - new_count} transitioned, {stable_count} stable, {new_count} new.")

    # Update previous state
    _PREVIOUS_USER_ASSIGNMENTS = {uid: assn["persona_name"] for uid, assn in user_assignments.items()}

    logger.info("--- Model Evaluation Metrics ---")
    logger.info("Accuracy / Precision / Recall / F1: Not available — unsupervised clustering without external ground-truth labels")
    logger.info(format_footer())

    return {
        "cluster_count": k,
        "user_assignments": user_assignments,
        "cluster_personas": cluster_personas,
        "scaled_matrix": scaled_matrix,
        "user_ids": user_ids
    }


if __name__ == "__main__":
    # Self-test
    mock_users = [
        {"user_id": 1, "total_sessions": 12, "avg_progress_pct": 85.0, "completed_books": 3, "bookmarks_count": 4, "reviews_count": 1, "avg_rating": 4.5, "genre_counts": {"fantasy": 4}},
        {"user_id": 2, "total_sessions": 2, "avg_progress_pct": 20.0, "completed_books": 0, "bookmarks_count": 0, "reviews_count": 0, "avg_rating": 3.0, "genre_counts": {"sci-fi": 1}},
        {"user_id": 3, "total_sessions": 9, "avg_progress_pct": 60.0, "completed_books": 1, "bookmarks_count": 3, "reviews_count": 5, "avg_rating": 4.8, "genre_counts": {"fantasy": 2, "mystery": 2}},
        {"user_id": 4, "total_sessions": 15, "avg_progress_pct": 95.0, "completed_books": 4, "bookmarks_count": 6, "reviews_count": 2, "avg_rating": 4.0, "genre_counts": {"mystery": 3}}
    ]
    res = cluster_readers(mock_users)
    print("Cluster Count:", res["cluster_count"])
    for uid, info in res["user_assignments"].items():
        print(f"User {uid}: Cluster {info['cluster_id']} ({info['persona_name']})")
    print("Personas:", res["cluster_personas"])
