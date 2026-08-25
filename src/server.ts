import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

const app: Express = express();

app.use(
  cors({
    origin: true, // or your frontend IP/domain
    credentials: true,
  }),
);

const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 2 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: "draft-7", // combined `RateLimit-Limit` and `RateLimit-Remaining`
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests from this IP, please try again after 5 minutes",
});

const authLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 30, // Limit each IP to 30 user-related requests per minute
  message: "Too many authentication attempts, please try again later",
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

import authRoutes from "./routes/auth.routes";
import { globalErrorHandler } from "./middlewares/error.middleware";

app.use(generalLimiter);
app.use("/auth", authLimiter, authRoutes);

app.use((req, res, next) => {
  res
    .status(404)
    .json({ message: `Cannot find ${req.originalUrl} on this server` });
});

app.use(globalErrorHandler);

export default app;
