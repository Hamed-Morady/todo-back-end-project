const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require('./db')
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require('dotenv').config();
const saltRound = 10;
const SECRET_KEY = process.env.SECRET_KEY;

const app = express();
app.use(bodyParser.json());
app.use(cors());

const verifyToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "توکن ارسال نشده است" });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: "توکن نامعتبر است" });
    req.user = user;
    next();
  });
};
// section login and register
app.post("/register", async (req, res) => {
  const { email, password, uname } = req.body;
  console.log(email);
  try {
    const checkUser = await db.query("SELECT * FROM users WHERE uname=$1", [
      uname,
    ]);
    if (checkUser.rows.length > 0) {
      return res.status(400).json({ massage: "درخواست نادرست است" });
    } else {
      bcrypt.hash(password, saltRound, async (err, hash) => {
        if (err) return res.status(400).json({ massage: "خطا در رمزگذاری" });
        await db.query(
          "INSERT INTO users(email,uname,password) VALUES($1,$2,$3)",
          [email, uname, hash]
        );
        return res.status(200).json({ message: "کاربر ریجستر شد" });
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "خطا", error });
  }
});

app.post("/login", async (req, res) => {
  const { password, uname } = req.body;
  try {
    const checkUserName = await db.query(
      "SELECT * FROM users WHERE uname =$1",
      [uname]
    );
    if (checkUserName.rows.length > 0) {
      const user = checkUserName.rows[0];
      const dbPassword = user.password;
      bcrypt.compare(password, dbPassword, (err, isMacth) => {
        if (err) return res.status(400).send({ message: "خطا در رمزگذاری" });
        if (isMacth) {
          const token = jwt.sign({ id: user.id }, SECRET_KEY, {
            expiresIn: "1h",
          });
          return res.status(200).json({ message: "ورود موفق", token });
        }
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "خطا", error });
  }
});

app.get("/dashboard", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;


    const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);

    if (result.rows.length === 0) {
      return res.status(403).json({ error: "شما ثبت‌نام نکرده‌اید." });
    }

    const user = result.rows[0];


    if (!user.is_registered) {
      return res.status(403).json({ error: "حساب شما هنوز ثبت‌نام نشده است." });
    }

    return res.status(200).json({ message: "خوش آمدید به داشبورد" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "خطای داخلی سرور" });
  }
});

// ///////////////////////////////////////////

app.post("/tody-task", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const todayData = req.body.todayData;

  try {
    const checkTodyTask = await db.query(
      "SELECT * FROM tasks WHERE data = $1 AND user_id = $2 AND done=false",
      [todayData, userId]
    );
    const tasksWithHourNumber = checkTodyTask.rows.map((task) => {
      const stimeHour = parseInt(task.stime.split(":")[0], 10);
      const etimeHour = parseInt(task.etime.split(":")[0], 10);

      return {
        ...task,
        stime: stimeHour,
        etime: etimeHour,
      };
    });

    res.json({ todyTask: tasksWithHourNumber });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "خطا در دریافت تسک‌های امروز" });
  }
});

app.post("/add-task", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { form, data } = req.body;
  const { todo, ftime, sctime, timePeriod } = form;
  function convertTo24HourFormat(hourStr, period) {
    let hour = parseInt(hourStr, 10);
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:00:00`; // hh:mm:ss
  }
  const formattedFtime = convertTo24HourFormat(ftime, timePeriod);
  const formattedSctime = convertTo24HourFormat(sctime, timePeriod);
  try {
    await db.query(
      "INSERT INTO tasks(todo, stime, etime, timeperiod, data, user_id) VALUES($1, $2, $3, $4, $5, $6)",
      [todo, formattedFtime, formattedSctime, timePeriod, data, userId]
    );
    return res.status(200).json({ message: "تسک با موفقیت افزوده شد" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "خطا در ذخیره تسک" });
  }
});

app.delete("/delete/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    await db.query("DELETE FROM tasks WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ]);
    return res.status(200).json({ message: "deleted task" });
  } catch (error) {
    console.log(error);
  }
});
// getTask with data
app.post("/get-tasks", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { selectedData } = req.body;
  try {
    const getTask = await db.query(
      "SELECT * FROM tasks WHERE data=$1 AND user_id=$2 AND done=false",
      [selectedData, userId]
    );

    // تبدیل ساعت‌ها به عدد ساعت
    const tasksWithHourNumber = getTask.rows.map((task) => {
      const stimeHour = parseInt(task.stime.split(":")[0], 10);
      const etimeHour = parseInt(task.etime.split(":")[0], 10);

      return {
        ...task,
        stime: stimeHour,
        etime: etimeHour,
      };
    });

    res.json({ getTask: tasksWithHourNumber });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/edit", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id, todo, ftime, sctime, timePeriod } = req.body;

  function convertTo24HourFormat(hourStr, period) {
    let hour = parseInt(hourStr, 10);
    if (period === "PM" && hour !== 12) hour += 12;
    if (period === "AM" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:00:00`; // hh:mm:ss
  }

  const formattedFtime = convertTo24HourFormat(ftime, timePeriod);
  const formattedSctime = convertTo24HourFormat(sctime, timePeriod);

  try {
    const result = await db.query(
      "UPDATE tasks SET todo=$1, stime=$2, etime=$3, timeperiod=$4 WHERE id=$5 AND user_id=$6 RETURNING *",
      [todo, formattedFtime, formattedSctime, timePeriod, id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No task found to update" });
    }

    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
});
app.patch("/done-task/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    await db.query("UPDATE tasks SET done = true WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ]);
    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    console.log(error);
  }
});
app.post("/get-completed-tasks", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { selectedData } = req.body;
  try {
    const getTask = await db.query(
      "SELECT * FROM tasks WHERE data=$1 AND user_id=$2 AND done=true",
      [selectedData, userId]
    );

    // تبدیل ساعت‌ها به عدد ساعت
    const tasksWithHourNumber = getTask.rows.map((task) => {
      const stimeHour = parseInt(task.stime.split(":")[0], 10);
      const etimeHour = parseInt(task.etime.split(":")[0], 10);

      return {
        ...task,
        stime: stimeHour,
        etime: etimeHour,
      };
    });

    res.json({ getTask: tasksWithHourNumber });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.patch("/undo-task/:id", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  try {
    await db.query("UPDATE tasks SET done = false WHERE id=$1 AND user_id=$2", [
      id,
      userId,
    ]);
    res.status(200).json({ message: "Task updated successfully" });
  } catch (error) {
    console.log(error);
  }
});
app.get("/stats", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    // روز فعلی
    const dayTasks = await db.query(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE user_id = $1
       AND data = EXTRACT(DAY FROM CURRENT_DATE)::int`,
      [userId]
    );

    // روز شروع هفته و روز پایان هفته
    const weekTasks = await db.query(
      `SELECT COUNT(*) AS count
       FROM tasks
       WHERE user_id = $1
       AND data BETWEEN EXTRACT(DAY FROM date_trunc('week', CURRENT_DATE))::int
                   AND EXTRACT(DAY FROM date_trunc('week', CURRENT_DATE) + interval '6 days')::int`,
      [userId]
    );
    // درصد تسک‌های انجام‌شده هفته جاری
    const weekCompleted = await db.query(
      `
SELECT
  COUNT(*) FILTER (WHERE done = true) * 100.0 / NULLIF(COUNT(*), 0) AS percent
FROM tasks
WHERE user_id = $1
AND data BETWEEN EXTRACT(DAY FROM date_trunc('week', CURRENT_DATE)) 
             AND EXTRACT(DAY FROM date_trunc('week', CURRENT_DATE) + interval '6 days')
`,
      [userId]
    );

    // درصد تسک‌های انجام‌شده امروز
    const dayCompleted = await db.query(
      `
SELECT
  COUNT(*) FILTER (WHERE done = true) * 100.0 / NULLIF(COUNT(*), 0) AS percent
FROM tasks
WHERE user_id = $1
AND data = EXTRACT(DAY FROM CURRENT_DATE)
`,
      [userId]
    );

    res.json({
      weekTasks: parseInt(weekTasks.rows[0].count, 10),
      dayTasks: parseInt(dayTasks.rows[0].count, 10),
      weekCompletedPercent: parseFloat(weekCompleted.rows[0].percent) || 0,
      dayCompletedPercent: parseFloat(dayCompleted.rows[0].percent) || 0,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "خطا در گرفتن آمار" });
  }
});

app.get("/filter-tasks", async (req, res) => {
  try {
    const { filterType, stime, etime, period } = req.query;
    let query = `SELECT * FROM tasks WHERE 1=1`;
    const values = [];
    let count = 1;

    if (filterType === "today") {
      const todayDay = new Date().getDate();
      query += ` AND data = $${count++}`;
      values.push(todayDay);
    }

    function convertTo24HourFormat(hour, period) {
      let h = parseInt(hour, 10);
      if (period === "PM" && h !== 12) h += 12;
      if (period === "AM" && h === 12) h = 0;
      return `${h.toString().padStart(2, "0")}:00:00`;
    }

    if (stime) {
      const formattedStart = convertTo24HourFormat(stime, period);
      query += ` AND stime >= $${count++}`;
      values.push(formattedStart);
    }

    if (etime) {
      const formattedEnd = convertTo24HourFormat(etime, period);
      query += ` AND etime <= $${count++}`;
      values.push(formattedEnd);
    }

    if (period) {
      query += ` AND timeperiod = $${count++}`;
      values.push(period);
    }

    query += ` ORDER BY data, stime`;

    const result = await db.query(query, values);

    // اینجا parseInt استفاده می‌کنیم ولی در نهایت نمایش دو رقمی می‌دیم
    const formattedRows = result.rows.map(task => {
      const stimeHour = parseInt(task.stime.split(":")[0], 10);
      const etimeHour = parseInt(task.etime.split(":")[0], 10);
    
      return {
        ...task,
        stime: stimeHour, // فقط عدد ساعت
        etime: etimeHour  // فقط عدد ساعت
      };
    });    

    res.json(formattedRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "خطا در واکشی داده‌ها" });
  }
});

app.listen(5000, () => {
  console.log("server is started on port 5000");
});








