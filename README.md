# ML Teaching Assistant Interview System

A full-stack web application for conducting interactive machine learning interviews with real-time feedback and scoring.

## Architecture

- **Backend**: Flask API server with ChromaDB for document retrieval and Ollama for LLM evaluation
- **Frontend**: Next.js React application with modern UI components
- **AI**: Uses Ollama models for embedding generation and interview evaluation

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
   ```powershell
   cd backend
   ```

2. Install Python dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

3. Make sure Ollama is running and has the required models:
   ```powershell
   ollama pull nomic-embed-text
   ollama pull llama3
   ```

4. Start the Flask server:
   ```powershell
   python app.py
   ```
   The backend will run on `https://9c13f2bf3856.ngrok-free.app`

### Frontend Setup

1. Navigate to the frontend directory:
   ```powershell
   cd frontend
   ```

2. Install Node.js dependencies:
   ```powershell
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```powershell
   npm run dev
   # or
   yarn dev
   ```
   The frontend will run on `http://localhost:3000`

## Usage

1. Open your browser and go to `http://localhost:3000`
2. Click "Start Interview" to begin
3. Answer the machine learning questions presented
4. Receive real-time scores and feedback
5. Continue through multiple rounds or end the interview

## Features

- **Interactive Interview Flow**: Real-time question-answer evaluation
- **Contextual AI Feedback**: Questions and evaluation based on lecture content
- **Score Tracking**: Individual question scores and running averages
- **Interview History**: View past questions and responses
- **Responsive Design**: Works on desktop and mobile devices
- **Modern UI**: Clean, professional interface with smooth animations

## API Endpoints

- `POST /api/start-interview` - Initialize a new interview session
- `POST /api/submit-answer` - Submit an answer and get evaluation
- `GET /api/interview-status` - Get current interview state
- `POST /api/end-interview` - End the interview and get final stats

## File Structure

```
backend/
├── app.py                  # Flask API server
├── retrieve_relevancy.py   # Core interview logic
├── requirements.txt        # Python dependencies
└── chroma_db/             # ChromaDB storage

frontend/
├── pages/
│   ├── index.js           # Main interview interface
│   └── api/               # Next.js API routes
├── styles/
│   └── Home.module.css    # Component styles
└── package.json           # Node.js dependencies
```

## Customization

- **Questions**: Modify `initialising_questions.json` to change starting questions
- **Models**: Update model names in `retrieve_relevancy.py` and `app.py`
- **Styling**: Edit `Home.module.css` for UI customization
- **Evaluation**: Adjust the prompt in `retrieve_relevancy.py` for different scoring criteria