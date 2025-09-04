import os
import ollama
import chromadb

# Init persistent Chroma DB
chroma_client = chromadb.PersistentClient(path="./chroma_db")
collection = chroma_client.get_or_create_collection("lectures")

# Folder containing transcripts
transcript_folder = "./extracted_pdfs"   # change path if needed

for file_name in os.listdir(transcript_folder):
    if file_name.endswith(".txt"):
        file_path = os.path.join(transcript_folder, file_name)

        with open(file_path, "r", encoding="utf-16") as f:
            transcript = f.read()

        # Chunk transcript
        chunks = [transcript[i:i+800] for i in range(0, len(transcript), 800)]

        # Store with embeddings
        for i, chunk in enumerate(chunks):
            emb = ollama.embeddings(model="nomic-embed-text", prompt=chunk)["embedding"]
            print(emb[:15])
            collection.add(
                ids=[f"{file_name}_{i}"],
                documents=[chunk],
                embeddings=[emb],
                metadatas=[{"source": file_name}]
            )

print("✅ All transcripts embedded & stored in Chroma")
