
const express = require("express");
const router = express.Router();
const Hall = require("../models/Hall");

// CREATE a hall
router.post("/", async (req, res) => {
  try {
    const { university, hallNo, rows, cols } = req.body;

    const hall = await Hall.create({
      university,
      hallNo,
      rows,
      cols
    });

    res.status(201).json({
      success: true,
      message: "Hall created successfully",
      hall: hall.toJSON({ virtuals: true })
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This hall number already exists for this university"
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// READ all halls (optionally filter by university)
router.get("/", async (req, res) => {
  try {
    const filter = {};

    if (req.query.university) {
      filter.university = req.query.university;
    }

    const halls = await Hall.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: halls.length,
      halls: halls.map(hall => hall.toJSON({ virtuals: true }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// READ one hall by MongoDB ID
router.get("/:id", async (req, res) => {
  try {
    const hall = await Hall.findById(req.params.id);

    if (!hall) {
      return res.status(404).json({
        success: false,
        message: "Hall not found"
      });
    }

    res.status(200).json({
      success: true,
      hall: hall.toJSON({ virtuals: true })
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid hall ID"
    });
  }
});

// UPDATE a hall
router.put("/:id", async (req, res) => {
  try {
    const allowedFields = ["university", "hallNo", "rows", "cols"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const hall = await Hall.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      {
        new: true,
        runValidators: true
      }
    );

    if (!hall) {
      return res.status(404).json({
        success: false,
        message: "Hall not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Hall updated successfully",
      hall: hall.toJSON({ virtuals: true })
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This hall number already exists for this university"
      });
    }

    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// DELETE a hall
router.delete("/:id", async (req, res) => {
  try {
    const hall = await Hall.findByIdAndDelete(req.params.id);

    if (!hall) {
      return res.status(404).json({
        success: false,
        message: "Hall not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Hall deleted successfully"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Invalid hall ID"
    });
  }
});

module.exports = router;
