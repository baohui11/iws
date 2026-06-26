# PostgreSQL 17 + pgvector（基础镜像）+ pgmq + pg_cron + zhparser + pg_jieba
FROM pgvector/pgvector:pg17

ARG PGMQ_VERSION=v1.5.1
ARG SCWS_VERSION=1.2.3

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    apt-get install -y --no-install-recommends \
      build-essential \
      cmake \
      git \
      pkg-config \
      automake \
      libtool \
      postgresql-server-dev-17 \
      postgresql-17-cron && \
    git clone --depth 1 --branch ${PGMQ_VERSION} \
      https://github.com/pgmq/pgmq.git /tmp/pgmq && \
    cd /tmp/pgmq/pgmq-extension && make && make install && \
    git clone --branch ${SCWS_VERSION} --single-branch --depth 1 \
      https://github.com/hightman/scws.git /tmp/scws && \
    cd /tmp/scws && \
    touch README && aclocal && autoconf && autoheader && libtoolize && \
    automake --add-missing && ./configure && make && make install && ldconfig && \
    git clone --single-branch --depth 1 \
      https://github.com/amutu/zhparser.git /tmp/zhparser && \
    cd /tmp/zhparser && make && make install && \
    git clone --single-branch --depth 1 \
      https://github.com/jaiminpan/pg_jieba.git /tmp/pg_jieba && \
    cd /tmp/pg_jieba && git submodule update --init --recursive && \
    mkdir /tmp/pg_jieba/build && cd /tmp/pg_jieba/build && \
    cmake -DPostgreSQL_TYPE_INCLUDE_DIR=/usr/include/postgresql/17/server \
          -DCMAKE_CXX_FLAGS="-Wall -std=c++11" .. && \
    make && make install && \
    rm -rf /tmp/pgmq /tmp/scws /tmp/zhparser /tmp/pg_jieba && \
    apt-get remove -y \
      build-essential cmake git pkg-config automake libtool postgresql-server-dev-17 && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
