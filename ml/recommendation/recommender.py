"""
Reader Recommendation and KNN Top Picks Engine
Uses K-Means reader clusters and K-Nearest Neighbors (KNN) collaborative filtering
to discover similar readers and surface personalized book suggestions and top picks.
"""

from typing import List, Dict, Any, Optional
import os
import sys
from datetime import datetime
import numpy as np
from sklearn.neighbors import NearestNeighbors

# Ensure root e-library directory is in sys.path for direct script or package execution
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

try:
    from ml.ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose
except ImportError:
    from ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose

from ml.clustering.reader_clustering import cluster_readers, build_reader_feature_vector


def get_user_recommendations(
    target_user_id: int,
    users_activity: List[Dict[str, Any]],
    all_published_books: List[Dict[str, Any]],
    user_read_book_ids: Optional[List[int]] = None,
    max_recommendations: int = 6
) -> Dict[str, Any]:
    """
    Computes personalized recommendations and KNN Top Picks for target_user_id:
    1. Clusters all readers using K-Means into literary archetypes.
    2. Uses K-Nearest Neighbors to find readers with the most similar reading habits.
    3. Aggregates books loved by nearest neighbors that the target user hasn't finished.
    4. Computes Top Picks with match confidence percentages and explanations.
    """
    if user_read_book_ids is None:
        user_read_book_ids = []

    user_read_set = set(user_read_book_ids)
    published_books_map = {b["id"]: b for b in all_published_books}

    # Fallback if no books exist
    if not all_published_books:
        return {
            "user_cluster": {
                "persona_name": "New Reader",
                "persona_description": "Welcome to the literary platform! Start reading books to unlock AI recommendations."
            },
            "top_picks": [],
            "cluster_recommendations": [],
            "similar_readers_count": 0,
            "is_cold_start": True
        }

    # 1. Run K-Means Reader Clustering
    clustering_results = cluster_readers(users_activity)
    user_assignments = clustering_results.get("user_assignments", {})
    target_cluster_info = user_assignments.get(target_user_id, {
        "cluster_id": 0,
        "persona_name": "Curious Explorer",
        "persona_description": "Readers discovering diverse catalogs and sampling opening chapters."
    })

    # Find target user's index in the matrix
    user_ids = clustering_results.get("user_ids", [])
    scaled_matrix = clustering_results.get("scaled_matrix")

    # Check if target user has sufficient history for KNN
    target_activity = next((u for u in users_activity if u["user_id"] == target_user_id), None)
    has_activity = target_activity and (
        target_activity.get("total_sessions", 0) > 0 or 
        target_activity.get("completed_books", 0) > 0 or
        target_activity.get("bookmarks_count", 0) > 0
    )

    candidate_scores: Dict[int, float] = {}
    neighbor_explanations: Dict[int, str] = {}
    similar_readers_found = 0

    if has_activity and scaled_matrix is not None and len(user_ids) > 1 and target_user_id in user_ids:
        target_idx = user_ids.index(target_user_id)
        n_samples = len(user_ids)
        k_neighbors = min(4, n_samples - 1)

        # 2. KNN Nearest Neighbors on reader habit feature space
        knn = NearestNeighbors(n_neighbors=k_neighbors + 1, metric="cosine")
        knn.fit(scaled_matrix)
        distances, indices = knn.kneighbors([scaled_matrix[target_idx]])

        neighbor_indices = indices[0][1:]  # Exclude self
        neighbor_distances = distances[0][1:]
        similar_readers_found = len(neighbor_indices)

        # 3. Aggregate reading engagements of nearest neighbors
        for n_idx, dist in zip(neighbor_indices, neighbor_distances):
            sim_weight = max(0.1, 1.0 - float(dist))  # Cosine similarity
            neighbor_uid = user_ids[n_idx]
            neighbor_data = next((u for u in users_activity if u["user_id"] == neighbor_uid), None)

            if not neighbor_data:
                continue

            neighbor_books = neighbor_data.get("engaged_books", [])
            for nb in neighbor_books:
                book_id = nb.get("book_id")
                # Skip if book is not published or target user has already completed it
                if book_id not in published_books_map or book_id in user_read_set:
                    continue

                progress = float(nb.get("progress_percentage", 50))
                rating = float(nb.get("rating", 4.0)) if nb.get("rating") else 4.0

                engagement_score = sim_weight * (progress / 100.0) * (rating / 5.0)

                if book_id not in candidate_scores:
                    candidate_scores[book_id] = 0.0
                    neighbor_explanations[book_id] = (
                        f"Read by similar {target_cluster_info['persona_name']} with {round(progress)}% completion"
                    )
                candidate_scores[book_id] += engagement_score

    # 4. Handle Cold-Start or Supplemental Recommendations
    is_cold_start = len(candidate_scores) == 0

    if len(candidate_scores) < max_recommendations:
        # Complement with highest-rated and popular published books
        for book in all_published_books:
            b_id = book["id"]
            if b_id in user_read_set or b_id in candidate_scores:
                continue

            # Prioritize target user's preferred genre if available
            genre_boost = 0.0
            if target_activity:
                top_genre = target_activity.get("top_genre")
                if top_genre and book.get("genre") and top_genre.lower() in book["genre"].lower():
                    genre_boost = 0.35

            rating = float(book.get("average_rating") or 4.2)
            review_count = int(book.get("reviews_count") or 1)
            pop_score = 0.5 * (rating / 5.0) + min(0.3, review_count * 0.05) + genre_boost

            candidate_scores[b_id] = pop_score
            neighbor_explanations[b_id] = (
                f"Curated {book.get('genre', 'Literary')} Top Pick (★ {rating:.1f})"
            )

    # 5. Format Top Picks with Match Percentages (70% - 98%)
    sorted_candidate_ids = sorted(candidate_scores.keys(), key=lambda x: candidate_scores[x], reverse=True)
    
    top_picks = []
    cluster_picks = []

    for rank, b_id in enumerate(sorted_candidate_ids[:max_recommendations]):
        book = published_books_map.get(b_id)
        if not book:
            continue

        raw_score = candidate_scores[b_id]
        # Map raw score to attractive 75% - 98% range
        match_pct = min(98, max(75, int(82 + (raw_score * 12) - (rank * 2))))

        pick_item = {
            "id": book["id"],
            "title": book["title"],
            "description": book.get("description"),
            "genre": book.get("genre"),
            "cover_image": book.get("cover_image"),
            "author_id": book.get("author_id"),
            "author_name": book.get("author_name") or "Platform Author",
            "average_rating": book.get("average_rating"),
            "chapters_count": book.get("chapters_count", 0),
            "match_score_pct": match_pct,
            "recommendation_reason": neighbor_explanations.get(b_id, "Recommended by AI Reader Matching")
        }

        top_picks.append(pick_item)
        if rank < 3:
            cluster_picks.append(pick_item)

    # Structured ML Console Logging
    logger = get_ml_logger("recommendation")
    logger.info(format_header(f"KNN PERSONALIZED RECOMMENDATIONS — Target Reader ID: {target_user_id}"))
    logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Target Reader Archetype: {target_cluster_info.get('persona_name', 'Unknown')}")
    
    k_val = k_neighbors if 'k_neighbors' in locals() else 0
    logger.info(f"KNN Configuration: k={k_val} neighbors | Eligible Neighbors Found: {similar_readers_found}")

    if similar_readers_found > 0 and 'neighbor_indices' in locals():
        logger.info("--- Nearest-Neighbor Reader Diagnostics ---")
        for n_idx, dist in zip(neighbor_indices, neighbor_distances):
            n_uid = user_ids[n_idx]
            weight = max(0.1, 1.0 - float(dist))
            logger.info(f"  Neighbor Reader ID {n_uid}: Cosine Distance = {float(dist):.4f} | Similarity Weight = {weight:.4f}")

    logger.info(f"Cold-Start Fallback Status: {'ACTIVATED (insufficient neighbor reads or new reader)' if is_cold_start else 'NOT ACTIVATED (collaborative filtering applied)'}")
    
    if is_ml_verbose() and candidate_scores:
        logger.info("--- Candidate Book Engagement Scores ---")
        for c_bid, c_score in sorted(candidate_scores.items(), key=lambda x: x[1], reverse=True)[:10]:
            c_title = published_books_map.get(c_bid, {}).get("title", f"Book #{c_bid}")
            logger.info(f"  Book ID {c_bid} ('{c_title}'): Engagement Score = {c_score:.4f}")

    logger.info("--- Final Ranked Recommendations ---")
    if top_picks:
        for idx, pick in enumerate(top_picks, start=1):
            logger.info(f"  #{idx} [ID {pick['id']}] '{pick['title']}' — Match: {pick['match_score_pct']}% | Reason: {pick['recommendation_reason']}")
    else:
        logger.info("  No recommendations generated. Reason: All published books are either finished by the user or catalog is empty.")

    logger.info("--- Model Evaluation Metrics ---")
    logger.info("Accuracy / Precision / Recall / F1: Not available — KNN collaborative filtering does not have an offline ground-truth interaction split")
    logger.info(format_footer())

    return {
        "user_cluster": {
            "cluster_id": target_cluster_info.get("cluster_id", 0),
            "persona_name": target_cluster_info.get("persona_name", "Curious Explorer"),
            "persona_description": target_cluster_info.get("persona_description", "Readers discovering diverse catalogs.")
        },
        "top_picks": top_picks,
        "cluster_recommendations": cluster_picks,
        "similar_readers_count": similar_readers_found,
        "is_cold_start": is_cold_start
    }


if __name__ == "__main__":
    # Self-test
    mock_users = [
        {
            "user_id": 1, "total_sessions": 12, "avg_progress_pct": 85.0, "completed_books": 3,
            "bookmarks_count": 4, "reviews_count": 2, "avg_rating": 4.5, "genre_counts": {"fantasy": 4},
            "engaged_books": [{"book_id": 101, "progress_percentage": 100, "rating": 5}, {"book_id": 102, "progress_percentage": 90, "rating": 4}]
        },
        {
            "user_id": 2, "total_sessions": 10, "avg_progress_pct": 75.0, "completed_books": 2,
            "bookmarks_count": 3, "reviews_count": 1, "avg_rating": 4.0, "genre_counts": {"fantasy": 3},
            "engaged_books": [{"book_id": 102, "progress_percentage": 85, "rating": 5}, {"book_id": 103, "progress_percentage": 95, "rating": 5}]
        },
        {
            "user_id": 3, "total_sessions": 2, "avg_progress_pct": 15.0, "completed_books": 0,
            "bookmarks_count": 0, "reviews_count": 0, "avg_rating": 3.0, "genre_counts": {"mystery": 1},
            "engaged_books": [{"book_id": 104, "progress_percentage": 20, "rating": 3}]
        }
    ]

    mock_books = [
        {"id": 101, "title": "Chronicles of Eldoria", "genre": "Fantasy", "author_name": "Elena Vance", "average_rating": 4.8, "chapters_count": 12},
        {"id": 102, "title": "The Glass Citadel", "genre": "Fantasy", "author_name": "Elena Vance", "average_rating": 4.6, "chapters_count": 8},
        {"id": 103, "title": "Whispers in the Mist", "genre": "Fantasy", "author_name": "Marcus Kane", "average_rating": 4.9, "chapters_count": 15},
        {"id": 104, "title": "Shadows of Baker Street", "genre": "Mystery", "author_name": "Arthur Doyle", "average_rating": 4.3, "chapters_count": 6}
    ]

    # Test for User 1 (has read 101 and 102, should be recommended 103 via neighbor User 2)
    recs = get_user_recommendations(target_user_id=1, users_activity=mock_users, all_published_books=mock_books, user_read_book_ids=[101, 102])
    print("User 1 Cluster:", recs["user_cluster"])
    print("Top Picks count:", len(recs["top_picks"]))
    for pick in recs["top_picks"]:
        print(f" - {pick['title']} ({pick['match_score_pct']}% Match): {pick['recommendation_reason']}")
