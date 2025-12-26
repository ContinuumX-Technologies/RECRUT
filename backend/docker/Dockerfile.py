FROM python:3.11-alpine

# Security: no root access
RUN adduser -D runner
USER runner

WORKDIR /app

CMD ["python3"]
