# Use a pre-built Hadoop image that supports WebHDFS
FROM bde2020/hadoop-namenode:2.0.0-hadoop3.2.1-java8

# Enable WebHDFS
ENV HDFS_CONF_dfs_webhdfs_enabled=true

# Expose the NameNode port and the WebHDFS port
EXPOSE 9000 9870

# The image's entrypoint will start the NameNode.
# The WebHDFS service runs as part of the NameNode.
