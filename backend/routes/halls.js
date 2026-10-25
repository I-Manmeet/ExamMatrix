const express = require("express");
const { requireLogin, requireRole } = require("../middleware/auth");
const halls = require("../controllers/hallController");

const router = express.Router();

// every hall route: logged-in university admin, only their own halls
router.use(requireLogin, requireRole("admin"));

router.get("/", halls.list);
router.get("/:id", halls.getOne);
router.post("/", halls.create);
router.put("/:id", halls.update);
router.delete("/:id", halls.remove);

module.exports = router;