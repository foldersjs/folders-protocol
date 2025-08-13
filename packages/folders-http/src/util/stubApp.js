export default function (uri, backend) {
  return function (conn) {
    conn.status = 200;
    conn.response.content = "Hello from stubApp";
  };
}
