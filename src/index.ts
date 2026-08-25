import dotenvFlow from "dotenv-flow";

dotenvFlow.config({
  node_env: process.env.NODE_ENV || "development",
  debug: process.env.NODE_ENV === "development",
});

import app from "./server";

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
