"""
Database seeding script for e-Library platform.
Inserts realistic sample users, books, chapters, tags, reviews, and reading progress.
Run with: python seed.py
"""
import sys
from datetime import datetime, timezone
from database import engine, SessionLocal, Base
import models
from models.user import User
from models.book import Book
from models.chapter import Chapter
from models.tag import Tag
from models.review import Review
from models.reading_progress import ReadingProgress
from models.reading_history import ReadingHistory
from auth.security import hash_password


def seed_database():
    print("Connecting to database and creating tables if they do not exist...")
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Please check your DATABASE_URL in .env and verify PostgreSQL is running.")
        sys.exit(1)

    db = SessionLocal()

    try:
        # Check if already seeded
        existing_user = db.query(User).filter(User.username == "author_elena").first()
        if existing_user:
            print("Database already contains seed data. Skipping seed process.")
            return

        print("Seeding initial users...")
        # 1. Author User
        author = User(
            username="author_elena",
            email="elena@example.com",
            password_hash=hash_password("author123"),
            display_name="Elena Vance",
            bio="Sci-Fi and Fantasy novelist exploring neon cities and ancient ruins.",
            role="author",
        )

        # 2. Reader User
        reader = User(
            username="reader_lucas",
            email="lucas@example.com",
            password_hash=hash_password("reader123"),
            display_name="Lucas Bennett",
            bio="Avid reader and literary critic.",
            role="reader",
        )

        # 3. Admin User
        admin = User(
            username="admin_user",
            email="admin@example.com",
            password_hash=hash_password("admin123"),
            display_name="System Administrator",
            bio="Platform administrator.",
            role="admin",
        )

        db.add_all([author, reader, admin])
        db.commit()
        db.refresh(author)
        db.refresh(reader)
        db.refresh(admin)

        print("Seeding tags...")
        # Tags
        tags = [
            Tag(name="Cyberpunk"),
            Tag(name="Mystery"),
            Tag(name="Dystopian"),
            Tag(name="High Fantasy"),
            Tag(name="Adventure"),
        ]
        db.add_all(tags)
        db.commit()
        for t in tags:
            db.refresh(t)

        print("Seeding books and chapters...")
        # Book 1
        book1 = Book(
            title="Echoes of the Neon Spire",
            description=(
                "In a vertical metropolis submerged in perpetual rain, an analytical archivist "
                "discovers coded whispers inside discarded neural memory chips."
            ),
            cover_image="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600",
            author_id=author.id,
            genre="Cyberpunk / Mystery",
            status="published",
            tags=[tags[0], tags[1], tags[2]],  # Cyberpunk, Mystery, Dystopian
        )
        db.add(book1)
        db.commit()
        db.refresh(book1)

        chapters_book1 = [
            Chapter(
                book_id=book1.id,
                chapter_number=1,
                title="The Rain on Level 94",
                content=(
                    "The raindrops struck the reinforced poly-glass of Level 94 with a hypnotic cadence. "
                    "Below, the iridescent smog of New Aethelgard swirled like oil on water. Silas adjusted "
                    "his optic filter, magnifying the street-level terminals three thousand meters below.\n\n"
                    "There was a rumor spreading through the subterranean data alleys: an unsanctioned neural "
                    "archive had breached the central transit grid, and it bore the signature of someone long dead."
                ),
            ),
            Chapter(
                book_id=book1.id,
                chapter_number=2,
                title="Memory Fragments",
                content=(
                    "Beneath the flickering blue holographic awnings of the old district market, Silas sat at a "
                    "greasy noodle stall. In his coat pocket, the stolen crystalline drive pulsed with warmth.\n\n"
                    "'You should not have brought that here,' an encrypted whisper hissed into his earpiece. "
                    "Silas did not turn around. 'If what's on this core is real, the Spire council has been rewriting "
                    "the historical logs for three centuries.'"
                ),
            ),
            Chapter(
                book_id=book1.id,
                chapter_number=3,
                title="The Archivist's Dilemma",
                content=(
                    "Every piece of recorded history had a price in the high city. Silas connected the optical bridge "
                    "to his neural rig. As the sensory data flooded his consciousness, the illusion shattered: "
                    "the city was not sinking—it was never built on land at all."
                ),
            ),
        ]
        db.add_all(chapters_book1)

        # Book 2
        book2 = Book(
            title="Chronicles of the Sunken Citadel",
            description=(
                "When the tides recede beneath the Blood Moon, the ancient gates of a submerged kingdom "
                "reveal arcane secrets and forgotten powers."
            ),
            cover_image="https://images.unsplash.com/photo-1519791883288-dc8bd696e667?w=600",
            author_id=author.id,
            genre="High Fantasy / Adventure",
            status="published",
            tags=[tags[3], tags[4], tags[1]],  # High Fantasy, Adventure, Mystery
        )
        db.add(book2)
        db.commit()
        db.refresh(book2)

        chapters_book2 = [
            Chapter(
                book_id=book2.id,
                chapter_number=1,
                title="The Receding Tide",
                content=(
                    "Captain Ronald adjusted the brass spyglass as the mist parted over the Sapphire Trench. "
                    "For seventy years, scholars believed the tales of Queen Thalassa's city were nothing more "
                    "than tavern folklore. Yet as the water drained away into the subterranean vortex, towering "
                    "spires carved of petrified coral pierced the evening twilight."
                ),
            ),
            Chapter(
                book_id=book2.id,
                chapter_number=2,
                title="Gates of Black Obsidian",
                content=(
                    "The seabed floor was cold and littered with centuries of sunken vessels. Lyra stepped across "
                    "the damp sand, her staff casting an amber glow across colossal obsidian doors. The runes "
                    "carved into the archway were written in the First Tongue: 'Only those who bring truth shall enter.'"
                ),
            ),
        ]
        db.add_all(chapters_book2)
        db.commit()

        print("Seeding reviews and ratings...")
        # Reviews
        review1 = Review(
            user_id=reader.id,
            book_id=book1.id,
            rating=5,
            review_text="An atmospheric masterpiece! The world-building on Level 94 feels intensely alive and believable.",
        )
        review2 = Review(
            user_id=reader.id,
            book_id=book2.id,
            rating=4,
            review_text="Compelling world and great pacing in the underwater ruins. Looking forward to the next chapter!",
        )
        db.add_all([review1, review2])

        print("Seeding reader activity (progress and history)...")
        # Reading Progress
        progress = ReadingProgress(
            user_id=reader.id,
            book_id=book1.id,
            chapter_id=chapters_book1[1].id,
            progress_percentage=65.0,
        )
        db.add(progress)

        # Reading History
        history1 = ReadingHistory(
            user_id=reader.id,
            book_id=book1.id,
            chapter_id=chapters_book1[0].id,
        )
        history2 = ReadingHistory(
            user_id=reader.id,
            book_id=book1.id,
            chapter_id=chapters_book1[1].id,
        )
        db.add_all([history1, history2])

        db.commit()
        print("\nSeed data created successfully!")
        print("Sample Accounts:")
        print("  - Author: username='author_elena', password='author123'")
        print("  - Reader: username='reader_lucas', password='reader123'")
        print("  - Admin:  username='admin_user',   password='admin123'")
        print("Books: 2 books with 5 total chapters, 5 tags, and reader reviews.")

    except Exception as exc:
        db.rollback()
        print(f"Error during seeding: {exc}")
        raise exc
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
