
const express = require("express");
const router = express.Router();

const Hall = require("../models/Hall");
const { AppError } = require("../middleware/errorHandler");

// TODO(after-jiya): replace with req.user.university + router.use(requireLogin, requireRole("admin"))
const uni = (req) => "UNI-0001";

// CREATE a hall
router.post("/", async (req, res) => {
  const { hallNo, rows, cols } = req.body;

  const hall = await Hall.create({
    university: uni(req),
    hallNo,
    rows,
    cols
  });

  res.status(201).json({
    data: hall.toJSON({ virtuals: true })
  });
});

// READ all halls for this university
router.get("/", async (req, res) => {
  const halls = await Hall.find({
    university: uni(req)
  }).sort({ createdAt: -1 });

  res.json({
    data: halls.map((hall) => hall.toJSON({ virtuals: true }))
  });
});

// READ one hall by ID
router.get("/:id", async (req, res) => {
  const hall = await Hall.findOne({
    _id: req.params.id,
    university: uni(req)
  });

  if (!hall) {
    throw new AppError(404, "Hall not found");
  }

  res.json({
    data: hall.toJSON({ virtuals: true })
  });
});

// UPDATE a hall
router.put("/:id", async (req, res) => {
  const { hallNo, rows, cols } = req.body;
  const updates = {};

  if (hallNo !== undefined) updates.hallNo = hallNo;
  if (rows !== undefined) updates.rows = rows;
  if (cols !== undefined) updates.cols = cols;

  const hall = await Hall.findOneAndUpdate(
    {
      _id: req.params.id,
      university: uni(req)
    },
    { $set: updates },
    {
      new: true,
      runValidators: true
    }
  );

  if (!hall) {
    throw new AppError(404, "Hall not found");
  }

  res.json({
    data: hall.toJSON({ virtuals: true })
  });
});

// DELETE a hall
router.delete("/:id", async (req, res) => {
  const hall = await Hall.findOneAndDelete({
    _id: req.params.id,
    university: uni(req)
  });

  if (!hall) {
    throw new AppError(404, "Hall not found");
  }

  res.json({
    data: hall.toJSON({ virtuals: true })
  });
});

module.exports = router;
