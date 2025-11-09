# Base image with Python 3.12 to avoid Py3.14 pydantic v1 issues
FROM python:3.12-slim

# Environment
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080 \
    TZ=UTC

WORKDIR /app

# System deps for WeasyPrint and related rendering libs
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libgdk-pixbuf2.0-0 \
    libffi-dev \
    fonts-liberation \
    fonts-dejavu-core \
    tzdata \
 && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . /app

# Expose the port Cloud Run will send traffic to
EXPOSE 8080

# Run uvicorn honoring the PORT env var provided by Cloud Run
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]