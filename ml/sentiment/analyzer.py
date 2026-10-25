"""
Review Sentiment Analysis and Literary Reception Engine
Performs text sentiment scoring, rating distribution analysis, topic extraction,
and generates structured visualization payloads for author-only book analytics.
"""

import os
import sys
import re
from typing import List, Dict, Any, Optional
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer, ENGLISH_STOP_WORDS

# Ensure e-library root directory is in sys.path
_root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _root_dir not in sys.path:
    sys.path.insert(0, _root_dir)

try:
    from ml.ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose
except ImportError:
    from ml_logging import get_ml_logger, format_header, format_footer, is_ml_verbose

# Domain-specific sentiment lexicon for literary prose reviews
POSITIVE_LEXICON = {
    "masterpiece": 2.5, "phenomenal": 2.3, "breathtaking": 2.2, "brilliant": 2.0,
    "captivating": 1.9, "gripping": 1.9, "spellbinding": 1.9, "unforgettable": 1.8,
    "poetic": 1.7, "compelling": 1.6, "intriguing": 1.5, "magnificent": 1.8,
    "loved": 1.7, "love": 1.5, "amazing": 1.7, "superb": 1.8, "wonderful": 1.6,
    "exceptional": 1.8, "fascinating": 1.6, "beautiful": 1.5, "thrilling": 1.6,
    "rich": 1.2, "enjoyed": 1.4, "immersive": 1.5, "vivid": 1.3, "clever": 1.4,
    "satisfying": 1.3, "recommend": 1.4, "gem": 1.7, "genius": 2.0, "favorite": 1.8
}

NEGATIVE_LEXICON = {
    "terrible": -2.3, "horrible": -2.2, "awful": -2.1, "disaster": -2.0,
    "boring": -1.8, "dull": -1.7, "bland": -1.5, "uninspired": -1.6,
    "disappointing": -1.7, "disappointed": -1.6, "shallow": -1.5, "flat": -1.4,
    "confusing": -1.4, "cliche": -1.5, "predictable": -1.4, "tedious": -1.7,
    "dragged": -1.5, "slow": -1.0, "rushed": -1.3, "mess": -1.8,
    "hated": -2.0, "hate": -1.8, "poorly": -1.6, "awkward": -1.3, "unrealistic": -1.2,
    "forced": -1.3, "forgettable": -1.5, "underwhelming": -1.6, "waste": -2.0
}

ASPECT_KEYWORDS = {
    "Characterization": ["character", "characters", "protagonist", "villain", "hero", "dialogue", "motivation", "development", "personality"],
    "Plot & Pacing": ["plot", "pacing", "twist", "ending", "beginning", "climax", "storyline", "arc", "flow", "cliffhanger", "slow", "fast"],
    "Worldbuilding & Atmosphere": ["world", "worldbuilding", "atmosphere", "setting", "lore", "magic", "realm", "environment", "mood"],
    "Prose & Style": ["prose", "writing", "style", "descriptions", "voice", "tone", "poetic", "metaphor", "imagery"]
}


def compute_text_sentiment(text: str) -> float:
    """
    Computes sentiment polarity between -1.0 (strongly negative) and +1.0 (strongly positive).
    """
    if not text:
        return 0.0

    tokens = re.findall(r'\b[a-z]+\b', text.lower())
    if not tokens:
        return 0.0

    score = 0.0
    intensity = 1.0

    for i, token in enumerate(tokens):
        # Handle negation (e.g. "not good", "never captivating")
        if i > 0 and tokens[i - 1] in {"not", "never", "no", "barely", "hardly"}:
            intensity = -0.8
        else:
            intensity = 1.0

        if token in POSITIVE_LEXICON:
            score += POSITIVE_LEXICON[token] * intensity
        elif token in NEGATIVE_LEXICON:
            score += NEGATIVE_LEXICON[token] * intensity

    # Normalize score based on text length to [-1.0, +1.0] range
    denom = max(3.0, len(tokens) ** 0.5)
    normalized = max(-1.0, min(1.0, score / denom))
    return round(normalized, 3)


def analyze_book_reviews(reviews_data: List[Dict[str, Any]], book_id: Optional[int] = None) -> Dict[str, Any]:
    """
    Analyzes all reviews for a book and produces statistical metrics,
    sentiment distributions, thematic extraction, and time-series data for author charts.
    Logs structured diagnostics to the backend console.
    """
    logger = get_ml_logger("sentiment")
    total_reviews = len(reviews_data)
    
    if total_reviews == 0:
        logger.info(format_header(f"SENTIMENT ANALYSIS ENGINE — Book ID: {book_id if book_id is not None else 'N/A'}"))
        logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("Reviews Analyzed: 0 reviews (no review data). Returning default empty state.")
        logger.info("Evaluation metrics: Not available — no labeled sentiment evaluation dataset (rule-based domain lexicon engine)")
        logger.info(format_footer())
        return {
            "has_data": False,
            "total_reviews": 0,
            "average_rating": 0.0,
            "sentiment_score": 0.0,
            "sentiment_label": "No Reviews Yet",
            "sentiment_breakdown": {
                "positive": 0,
                "neutral": 0,
                "negative": 0,
                "positive_pct": 0,
                "neutral_pct": 0,
                "negative_pct": 0
            },
            "rating_distribution": {
                "5": 0, "4": 0, "3": 0, "2": 0, "1": 0,
                "percentages": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
            },
            "aspect_sentiments": {},
            "key_themes": [],
            "timeline": [],
            "author_takeaways": "Publish chapters and share your work with readers to begin generating sentiment analytics."
        }

    # 1. Rating Distribution
    ratings = [int(r.get("rating", 3)) for r in reviews_data]
    avg_rating = round(sum(ratings) / total_reviews, 2)
    
    rating_counts = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    for r in ratings:
        k = str(max(1, min(5, r)))
        rating_counts[k] += 1

    rating_pcts = {
        k: round((v / total_reviews) * 100, 1) for k, v in rating_counts.items()
    }

    # 2. Sentiment Polarity Analysis per review
    processed_reviews = []
    pos_count = 0
    neu_count = 0
    neg_count = 0
    total_compound_sentiment = 0.0

    all_texts = []

    for r in reviews_data:
        rating_val = int(r.get("rating", 3))
        text = (r.get("review_text") or "").strip()
        created_at = r.get("created_at")

        # Rating gives baseline sentiment (-1 to +1)
        rating_norm = round((rating_val - 3.0) / 2.0, 3)  # 1->-1, 2->-0.5, 3->0, 4->0.5, 5->1.0

        if text:
            all_texts.append(text)
            text_polarity = compute_text_sentiment(text)
            # Weighted combination: 60% text NLP, 40% star rating
            compound = round(0.6 * text_polarity + 0.4 * rating_norm, 3)
        else:
            text_polarity = 0.0
            compound = rating_norm

        total_compound_sentiment += compound

        if compound >= 0.2:
            category = "positive"
            pos_count += 1
        elif compound <= -0.2:
            category = "negative"
            neg_count += 1
        else:
            category = "neutral"
            neu_count += 1

        processed_reviews.append({
            "id": r.get("id"),
            "rating": rating_val,
            "rating_norm": rating_norm,
            "text_polarity": text_polarity,
            "text": text,
            "sentiment_score": compound,
            "category": category,
            "created_at": created_at
        })

    avg_compound = round(total_compound_sentiment / total_reviews, 3)

    # Human-readable sentiment label
    if avg_compound >= 0.45:
        sentiment_label = "Overwhelmingly Positive"
    elif avg_compound >= 0.15:
        sentiment_label = "Favorable & Positive"
    elif avg_compound >= -0.15:
        sentiment_label = "Balanced & Mixed"
    elif avg_compound >= -0.45:
        sentiment_label = "Constructive / Critical"
    else:
        sentiment_label = "Predominantly Critical"

    pos_pct = round((pos_count / total_reviews) * 100, 1)
    neu_pct = round((neu_count / total_reviews) * 100, 1)
    neg_pct = round((neg_count / total_reviews) * 100, 1)

    # 3. Aspect-Based Breakdown (Characters, Plot/Pacing, World, Prose)
    aspect_scores = {}
    combined_corpus = " ".join(all_texts).lower()
    
    for aspect_name, keywords in ASPECT_KEYWORDS.items():
        relevant_reviews = [
            pr for pr in processed_reviews 
            if any(kw in (pr["text"] or "").lower() for kw in keywords)
        ]
        if relevant_reviews:
            aspect_avg = round(
                sum(pr["sentiment_score"] for pr in relevant_reviews) / len(relevant_reviews), 2
            )
            aspect_scores[aspect_name] = {
                "score": aspect_avg,
                "mentions": len(relevant_reviews),
                "status": "Positive" if aspect_avg >= 0.15 else ("Critical" if aspect_avg <= -0.15 else "Neutral")
            }
        else:
            aspect_scores[aspect_name] = {
                "score": avg_compound,
                "mentions": 0,
                "status": "General"
            }

    # 4. TF-IDF Thematic Phrase Extraction from Reviews
    key_themes = []
    if all_texts and len(all_texts) > 0:
        try:
            custom_stops = set(ENGLISH_STOP_WORDS).union({"book", "read", "reading", "author", "story"})
            vec = TfidfVectorizer(ngram_range=(1, 2), stop_words=list(custom_stops), max_features=10)
            mat = vec.fit_transform(all_texts)
            terms = vec.get_feature_names_out()
            scores = mat.toarray().sum(axis=0)
            sorted_terms = sorted(zip(terms, scores), key=lambda x: x[1], reverse=True)
            
            for term, score in sorted_terms[:6]:
                # Determine context sentiment for this term
                term_sentiment = "neutral"
                matching_revs = [pr["sentiment_score"] for pr in processed_reviews if term in (pr["text"] or "").lower()]
                if matching_revs:
                    term_avg = sum(matching_revs) / len(matching_revs)
                    if term_avg >= 0.15:
                        term_sentiment = "positive"
                    elif term_avg <= -0.15:
                        term_sentiment = "critical"

                key_themes.append({
                    "phrase": term,
                    "sentiment": term_sentiment,
                    "relevance": round(float(score), 2)
                })
        except Exception:
            key_themes = []

    # 5. Timeline / Chronological Trend (cumulative or periodic)
    timeline_entries = []
    # Sort reviews by date if available, or by index
    sorted_reviews = sorted(
        processed_reviews,
        key=lambda r: str(r.get("created_at") or "")
    )
    running_sum = 0
    for idx, rev in enumerate(sorted_reviews):
        running_sum += rev["rating"]
        cum_avg = round(running_sum / (idx + 1), 2)
        date_str = ""
        if rev.get("created_at"):
            try:
                if isinstance(rev["created_at"], str):
                    date_str = rev["created_at"][:10]
                elif hasattr(rev["created_at"], "strftime"):
                    date_str = rev["created_at"].strftime("%Y-%m-%d")
            except Exception:
                date_str = f"Review #{idx+1}"
        else:
            date_str = f"Rev #{idx+1}"

        timeline_entries.append({
            "label": date_str,
            "rating": rev["rating"],
            "cumulative_avg": cum_avg,
            "sentiment": rev["sentiment_score"]
        })

    # Keep timeline to maximum 12 points for clean graph rendering
    if len(timeline_entries) > 12:
        step = len(timeline_entries) // 12
        sampled_timeline = timeline_entries[::step][:12]
    else:
        sampled_timeline = timeline_entries

    # 6. Actionable Author Summary Takeaways
    if pos_pct >= 70:
        takeaway = f"Readers show exceptionally high enthusiasm ({pos_pct}% positive feedback). Your storytelling and pacing resonate strongly with your audience."
    elif neg_pct >= 40:
        takeaway = f"Readers have provided valuable critical feedback ({neg_pct}% constructive critiques). Consider reviewing the pacing and character arcs in upcoming revisions."
    else:
        takeaway = f"Your manuscript maintains balanced readership engagement ({pos_pct}% positive, {neu_pct}% neutral). Readers find the concepts intriguing."

    # Structured ML Console Logging
    logger.info(format_header(f"SENTIMENT ANALYSIS ENGINE — Book ID: {book_id if book_id is not None else 'N/A'}"))
    logger.info(f"Execution Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Dataset Size: {total_reviews} reviews analyzed")
    logger.info(f"Class Distribution: Positive={pos_count} ({pos_pct}%), Neutral={neu_count} ({neu_pct}%), Negative={neg_count} ({neg_pct}%)")
    logger.info(f"Rating Distribution: 5★: {rating_counts['5']}, 4★: {rating_counts['4']}, 3★: {rating_counts['3']}, 2★: {rating_counts['2']}, 1★: {rating_counts['1']} (Avg: ★ {avg_rating})")
    logger.info(f"Overall Compound Score: {avg_compound:+.3f} | Sentiment Label: {sentiment_label}")

    if is_ml_verbose():
        logger.info("--- Individual Review Scoring ---")
        for idx, pr in enumerate(processed_reviews):
            rev_label = f"Review #{pr['id'] or idx+1}"
            logger.info(
                f"  [{rev_label}] Star: {pr['rating']}★ | "
                f"RatingNorm: {pr['rating_norm']:+.2f} | "
                f"TextPolarity: {pr['text_polarity']:+.3f} | "
                f"Compound: {pr['sentiment_score']:+.3f} -> {pr['category'].upper()}"
            )

    logger.info("--- Aspect Discussion Scores ---")
    for aspect_name, asp_data in aspect_scores.items():
        logger.info(f"  • {aspect_name}: Mentions={asp_data['mentions']} | Score={asp_data['score']:+.2f} ({asp_data['status']})")

    if key_themes:
        theme_strs = [f"'{kt['phrase']}' ({kt['sentiment']}, rel={kt['relevance']})" for kt in key_themes]
        logger.info(f"Extracted Keywords (TF-IDF): {', '.join(theme_strs)}")
    else:
        logger.info("Extracted Keywords (TF-IDF): None detected")

    logger.info("--- Model Evaluation Metrics ---")
    logger.info("Accuracy / Precision / Recall / F1: Not available — no labeled test dataset (rule-based literary lexicon engine)")
    logger.info(format_footer())

    return {
        "has_data": True,
        "total_reviews": total_reviews,
        "average_rating": avg_rating,
        "sentiment_score": avg_compound,
        "sentiment_label": sentiment_label,
        "sentiment_breakdown": {
            "positive": pos_count,
            "neutral": neu_count,
            "negative": neg_count,
            "positive_pct": pos_pct,
            "neutral_pct": neu_pct,
            "negative_pct": neg_pct
        },
        "rating_distribution": {
            "5": rating_counts["5"],
            "4": rating_counts["4"],
            "3": rating_counts["3"],
            "2": rating_counts["2"],
            "1": rating_counts["1"],
            "percentages": rating_pcts
        },
        "aspect_sentiments": aspect_scores,
        "key_themes": key_themes,
        "timeline": sampled_timeline,
        "author_takeaways": takeaway
    }


if __name__ == "__main__":
    # Self-test
    mock_reviews = [
        {"rating": 5, "review_text": "An absolute masterpiece of gothic fantasy! The atmosphere and characters are unforgettable.", "created_at": "2026-09-01"},
        {"rating": 5, "review_text": "Breathtaking prose and gripping plot twists. Truly loved every single chapter!", "created_at": "2026-09-05"},
        {"rating": 4, "review_text": "Very compelling worldbuilding and vivid dialogue. Pacing felt a bit slow in the middle though.", "created_at": "2026-09-12"},
        {"rating": 2, "review_text": "The characters felt slightly flat and predictable, but the magic system was interesting.", "created_at": "2026-09-20"},
        {"rating": 5, "review_text": "Brilliant and thrilling. Highly recommend to all fantasy lovers!", "created_at": "2026-09-28"}
    ]
    res = analyze_book_reviews(mock_reviews)
    print("Sentiment Score:", res["sentiment_score"])
    print("Label:", res["sentiment_label"])
    print("Breakdown:", res["sentiment_breakdown"])
    print("Ratings:", res["rating_distribution"])
    print("Aspects:", res["aspect_sentiments"])
    print("Takeaways:", res["author_takeaways"])
