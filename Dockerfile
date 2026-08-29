FROM python:3.11-slim

# jadx is a Java tool. The image therefore needs a JRE. The headless build
# pulls in no GUI libraries. That keeps the image smaller. unzip and curl are
# only needed to fetch and unpack jadx during the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        default-jre-headless \
        curl \
        unzip \
    && rm -rf /var/lib/apt/lists/*

# Pinned on purpose. Tracking the latest release would let a future jadx
# version change behaviour or break the build with no change on our side.
ENV JADX_VERSION=1.5.6

RUN curl -fsSL -o /tmp/jadx.zip \
        "https://github.com/skylot/jadx/releases/download/v${JADX_VERSION}/jadx-${JADX_VERSION}.zip" \
    && mkdir -p /opt/jadx \
    && unzip -q /tmp/jadx.zip -d /opt/jadx \
    && rm /tmp/jadx.zip \
    && chmod +x /opt/jadx/bin/jadx

# Put jadx on PATH so shutil.which("jadx") in backend/apk.py finds it with no
# code change.
ENV PATH="/opt/jadx/bin:${PATH}"

WORKDIR /app

# Dependencies are copied first so the pip layer is cached between builds when
# only application code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render sets PORT at runtime. The default keeps the image usable locally.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port $PORT"]
