const test = require("node:test");

const assert = require("node:assert");

const { findSeat } = require("../controllers/publicController.js");

const seatMap = {

  "Hall A": [

    [{ roll: "24AI1001", code: "AI302" }, null],

    [null, { roll: "24CS2001", code: "CS301" }]

  ],

  "Hall B": [

    [{ roll: "24EC3001", code: "EC301" }]

  ]

};

test("findSeat: gives hall, row and seat counted from 1", () => {

  assert.deepStrictEqual(findSeat(seatMap, "24CS2001"), { hall: "Hall A", row: 2, seat: 2, code: "CS301" });

  assert.deepStrictEqual(findSeat(seatMap, "24EC3001"), { hall: "Hall B", row: 1, seat: 1, code: "EC301" });

});

test("findSeat: unknown roll or empty seat map gives null", () => {

  assert.strictEqual(findSeat(seatMap, "NOPE"), null);

  assert.strictEqual(findSeat({}, "24AI1001"), null);

  assert.strictEqual(findSeat(undefined, "24AI1001"), null);

});
