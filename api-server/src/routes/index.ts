import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import storageRouter from "./storage";
import benchmarksRouter from "./benchmarks";
import editorRouter from "./editor";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(storageRouter);
router.use(benchmarksRouter);
router.use(editorRouter);

export default router;
