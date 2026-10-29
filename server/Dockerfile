FROM node:22-slim

# 파이썬 + pip 설치
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Node 의존성 설치 (캐시 활용을 위해 package.json 먼저 복사)
COPY package*.json ./
RUN npm install --omit=dev

# 파이썬 의존성 설치
COPY requirements.txt ./
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# 나머지 소스 복사
COPY . .

ENV PYTHON_BIN=/usr/bin/python3
ENV POSTPROCESS_PY=/app/postprocess_simple.py

EXPOSE 3001
CMD ["node", "index.js"]