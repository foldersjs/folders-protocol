# Use the official Apache Hive image
FROM apache/hive:4.0.0

# Set the service to run as hiveserver2
ENV SERVICE_NAME hiveserver2

# Expose the HiveServer2 port and the web UI port
EXPOSE 10000 10002

# The default command for the apache/hive image handles the service startup
# CMD ["/opt/entrypoint.sh"]
