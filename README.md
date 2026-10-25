# Scribe & Spire — Literary Reading & Analytical Platform

Scribe & Spire is a full-stack literary publishing and reading platform featuring reader engagement verification, author review sentiment analytics, K-Means reader habit clustering, KNN personalized book recommendations, and supervised NLP genre classification.

---

## Architecture & Project Structure

```text
e-library/
├── frontend/                     # React + Vite single-page application
│   ├── src/
│   │   ├── components/           # Reusable UI components (AuthorReviewAnalytics, BookCard, Navbar, etc.)
│   │   ├── context/              # Authentication and global state
│   │   ├── pages/                # Pages (Home, Library, BookDetails, Reader, Profile, AuthorDashboard, EditBook)
│   │   ├── services/             # Axios HTTP client configuration
│   │   ├── App.jsx               # Main React router and route declarations
│   │   └── main.jsx              # Application mount point
│   ├── package.json              # Frontend dependencies and npm scripts
│   ├── package-lock.json         # Locked dependency tree
│   ├── vite.config.js            # Vite bundler configuration
│   └── .env.example              # Frontend environment variables template
│
├── backend/                      # Python FastAPI REST backend
│   ├── auth/                     # JWT tokens, password hashing, and authentication dependencies
│   ├── models/                   # SQLAlchemy ORM models (User, Book, Chapter, Review, ReadingProgress, etc.)
│   ├── routers/                  # API endpoints (auth, books, chapters, reviews, reading, ml, users, tags)
│   ├── schemas/                  # Pydantic request/response validation schemas
│   ├── database.py               # Database connection and session management
│   ├── main.py                   # FastAPI application entrypoint with lifespan DDL initialization
│   ├── seed.py                   # Optional database seeder for initial demonstration
│   ├── requirements.txt          # Python backend dependencies
│   └── .env.example              # Backend environment variables template
│
├── ml/                           # Machine Learning & NLP subsystem
│   ├── classification/           # Supervised genre classification (TF-IDF + Logistic Regression)
│   │   ├── genre_classifier.joblib # Pretrained classification model artifact
│   │   ├── genre_labels.json     # Class label taxonomy
│   │   ├── tagger.py             # Inference module for AI tag suggestions
│   │   └── train_classifier.py   # Training & evaluation pipeline on CMU dataset
│   ├── clustering/               # Reader habit clustering (K-Means + literary personas)
│   │   └── kmeans_engine.py      # Feature extraction, clustering, inertia & persona assignment
│   ├── recommendation/           # Personalized recommendations (KNN collaborative filtering)
│   │   └── recommender.py        # Nearest-neighbor matching, candidate scoring, and cold-start fallback
│   ├── sentiment/                # Rule-based literary sentiment & aspect analysis
│   │   └── engine.py             # Polarity scoring, rating normalization, aspect breakdown
│   └── ml_logging.py             # Formatted terminal logging for ML diagnostics
│
└── README.md                     # Complete project documentation
```

---

## 1. Prerequisites & System Requirements

- **Operating System:** Windows 10/11, macOS, or Linux
- **Python:** Python 3.10, 3.11, 3.12, or 3.13
- **Node.js:** Node.js v18+ and npm v9+
- **Database:** PostgreSQL 14+ (Local installation or cloud PostgreSQL)

---

## 2. Installation & Setup (Windows Instructions)

### A. Database Setup (PostgreSQL)

1. Open **pgAdmin** or the **SQL Shell (psql)**:
   ```powershell
   psql -U postgres
   ```
2. Create the application database:
   ```sql
   CREATE DATABASE elibrary;
   ```
3. Exit `psql`:
   ```sql
   \q
   ```

### B. Backend Setup (FastAPI)

1. Open **PowerShell** and navigate to the `backend` folder:
   ```powershell
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   *(If PowerShell gives an execution policy error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first).*

3. Upgrade pip and install all backend dependencies:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. Create your `.env` configuration file from the template:
   ```powershell
   Copy-Item .env.example .env
   ```

5. Edit `backend/.env` with your PostgreSQL password:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/elibrary
   SECRET_KEY=a-secure-random-secret-key-change-this-in-production
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   ML_LOG_VERBOSE=true
   ```

6. **(Optional) Seed the Database with Demo Data:**
   To populate initial sample books, chapters, tags, reviews, and test accounts:
   ```powershell
   python seed.py
   ```
   *Note: Only run this once on a fresh database. It safely skips if demo data already exists.*

7. Start the FastAPI backend server:
   ```powershell
   uvicorn main:app --reload --port 8000
   ```
   - **API Base:** `http://localhost:8000`
   - **Swagger Docs:** `http://localhost:8000/docs`

### C. Frontend Setup (React + Vite)

1. Open a **second PowerShell window** and navigate to the `frontend` folder:
   ```powershell
   cd frontend
   ```

2. Install frontend dependencies:
   ```powershell
   npm install
   ```

3. Copy the frontend environment template:
   ```powershell
   Copy-Item .env.example .env
   ```
   *(Ensure `VITE_API_URL=http://localhost:8000` is set).*

4. Start the Vite development server:
   ```powershell
   npm run dev
   ```
   - **Web App:** `http://localhost:5173`

---

## 3. Seeded Demo Accounts

If you run `python seed.py`, the following demo accounts are created:

| Role | Username | Password | Details |
| :--- | :--- | :--- | :--- |
| **Author** | `author_elena` | `author123` | Published author of *Echoes of the Neon Spire* |
| **Reader** | `reader_lucas` | `reader123` | Active reader with reading history & bookmarks |
| **Admin** | `admin_user` | `admin123` | Platform administrative access |

*(You can also register fresh reader or author accounts anytime via `/register`).*

---

## 4. Key Features & How to Test

### A. Review Gating (Reading Engagement Verification)
- **Problem:** On traditional platforms, users can submit arbitrary 1-star or 5-star reviews without ever opening the book.
- **Solution:** A reader must open a chapter and scroll through at least **20%** of the manuscript prose before review submission is unlocked.
- **How to Test:**
  1. Log in as a reader and navigate to any published book (e.g. `/books/1`).
  2. Scroll down to the "Write a Review" section: the review form is **LOCKED** with an engagement notice, and inputs are disabled.
  3. Click **"Open Chapter 1 to Start Reading →"**.
  4. Spend at least 2 seconds on the page and scroll down through the story content past 20%.
  5. Return to the book page: the review form will display **"✓ Verified Reader"** and review submission will be unlocked.
- **Server Safeguards:**
  - Prevents rapid robotic bypasses (minimum elapsed reading time of 1.5s enforced).
  - Verifies chapter belongs to the specified book.
  - Limits scroll progress strictly between 0% and 100%.
  - Enforces one review per book per user.

### B. Simplified Author Review Analytics
- **Location:** On any book authored by the logged-in author (e.g. `/books/1` when logged in as `author_elena`).
- **Displays:**
  - **Reader Sentiment Donut Chart:** Visual breakdown of Positive, Neutral, and Critical sentiment with overall compound score.
  - **Google Play-Style Rating Histogram:** Clean 5★ down to 1★ distribution bars.
  - **Author Takeaways:** High-level summary of reader feedback reception.
  - **Reader Comments:** Individual reader comments and star ratings.
  - *Complex raw keyword matrices and aspect cards are cleanly hidden for an uncluttered author experience.*

### C. Personalized Recommendations
- **Location:** Open the **Reader Profile** page (`/profile`).
- **How it Works:**
  - Employs **K-Means Clustering** on reading habit features (reading progress, completed sessions, bookmark counts, review behavior, and genre distributions) to derive literary personas (e.g. *Casual Story Seekers*, *Curious Explorers*, *Literary Critics*).
  - Uses **KNN (K-Nearest Neighbors)** collaborative filtering with cosine distance to find readers with similar literary taste and recommend their top-rated books.
  - **Cold-Start Handling:** For new readers without reading activity, cold-start fallback automatically activates, providing top-rated catalog recommendations with curated genres.
  - **Draft Exclusion:** Unpublished draft manuscripts are strictly excluded from recommendation candidates.
  - **Match Badges:** Recommendation cards display heuristic match percentage badges (e.g. `88% Match`).

### D. Author Book Editing
- **Location:** `/author/books/:bookId/edit` (or click "Edit Book" on the Author Dashboard / Book Details).
- **Features:** Edit title, genre, publication status, synopsis, cover image, and run the ML AI Tag Suggester.

---

## 5. Machine Learning Terminal Logging

Every ML operation emits structured, formatted terminal logs showing diagnostics, algorithms, and evaluation metrics:

- **Sentiment Analysis:** Outputs review counts, star distributions, compound scores, polarity, aspect scores, and TF-IDF extracted phrases.
- **K-Means Clustering:** Outputs feature matrix shapes, $k$ value, inertia, silhouette scores, persona centroids, reader assignments, and state transitions.
- **KNN Recommendations:** Outputs target reader persona, neighbor count, cosine distances, candidate engagement scores, and final ranked recommendations.
- **Supervised Genre Tagger:** Outputs input synopsis length, model artifact used, predicted genre class, and confidence score.

### Enabling Verbose Logs
Ensure `ML_LOG_VERBOSE=true` is set in `backend/.env`.

---

## 6. Known Limitations & Technical Notes

1. **Browser Scroll Measurement:**
   - Scroll tracking calculates progress against the readable prose container (`.manuscript-body`), ignoring navigation headers and footers.
   - While server-side timing rules prevent instant script execution, client-side scrolling verifies manuscript navigation rather than cognitive comprehension.
2. **Genre Classification Model:**
   - The included `genre_classifier.joblib` was trained on the CMU Book Summary Dataset across 141 multi-class literary genres using TF-IDF and balanced Logistic Regression. Single-sample inference returns the highest-confidence predicted genre.
3. **Database Migration Safety:**
   - On backend startup, the FastAPI `lifespan` handler checks for the existence of `max_scroll_percentage` and `review_eligible` in `reading_progress` and safely executes idempotent `ALTER TABLE` statements without dropping or modifying existing data.
