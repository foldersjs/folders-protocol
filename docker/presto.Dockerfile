# Use the official PrestoDB image
FROM prestodb/presto:latest

# Copy the configuration files into the container
COPY presto.config.properties /opt/presto-server/etc/config.properties
COPY presto.jvm.config /opt/presto-server/etc/jvm.config

# Expose the Presto port
EXPOSE 8080

# The default command will start the Presto server
