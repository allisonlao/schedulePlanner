import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const COURSE_DATA = [
  {
    courseNumber: "15-251",
    name: "Great Ideas in Theoretical CS",
    sections: [
      { id: "A", days: ["Mon", "Wed"], start: 10, end: 11.33 },
      { id: "B", days: ["Tue", "Thu"], start: 9.5, end: 10.83 },
    ],
  },
  {
    courseNumber: "15-259",
    name: "Probability and Computing",
    sections: [
      { id: "A", days: ["Mon", "Wed"], start: 14, end: 15.33 },
      { id: "B", days: ["Tue", "Thu"], start: 12, end: 13.33 },
    ],
  },
  {
    courseNumber: "33-104",
    name: "Experimental Physics",
    sections: [
      { id: "A", days: ["Mon", "Wed"], start: 13, end: 15 },
      { id: "B", days: ["Tue"], start: 14, end: 17 },
    ],
  },
];

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function formatHour(value) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const totalMinutes = Math.round(safeValue * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

function cloneCourse(course) {
  return {
    courseNumber: course.courseNumber,
    name: course.name,
    sections: course.sections.map((section) => ({ ...section })),
  };
}

function pickRandomSection(course) {
  const randomIndex = Math.floor(Math.random() * course.sections.length);
  return course.sections[randomIndex];
}

function buildMeetings(scheduleCourses) {
  const meetings = [];

  for (const course of scheduleCourses) {
    const selectedSection = course.sections.find(
      (section) => section.id === course.selectedSectionId,
    );

    if (!selectedSection) {
      continue;
    }

    for (const day of selectedSection.days) {
      meetings.push({
        day,
        start: selectedSection.start,
        end: selectedSection.end,
      });
    }
  }

  return meetings;
}

function overlapHours(meetingA, meetingB) {
  if (meetingA.day !== meetingB.day) {
    return 0;
  }

  const start = Math.max(meetingA.start, meetingB.start);
  const end = Math.min(meetingA.end, meetingB.end);
  return Math.max(0, end - start);
}

function scoreSchedule(scheduleCourses, preference) {
  const meetings = buildMeetings(scheduleCourses);

  // Overlaps should dominate the score so invalid schedules are avoided.
  let overlapPenalty = 0;
  for (let i = 0; i < meetings.length; i += 1) {
    for (let j = i + 1; j < meetings.length; j += 1) {
      overlapPenalty += overlapHours(meetings[i], meetings[j]) * 1000;
    }
  }

  const meetingsByDay = new Map(DAY_ORDER.map((day) => [day, []]));
  for (const meeting of meetings) {
    meetingsByDay.get(meeting.day)?.push(meeting);
  }

  let gapScore = 0;
  for (const day of DAY_ORDER) {
    const dayMeetings = meetingsByDay.get(day) ?? [];
    dayMeetings.sort((a, b) => a.start - b.start);

    for (let i = 0; i < dayMeetings.length - 1; i += 1) {
      const gap = Math.max(0, dayMeetings[i + 1].start - dayMeetings[i].end);
      if (preference === "spread") {
        gapScore += gap * 10;
      } else {
        gapScore -= gap * 10;
      }
    }
  }

  return gapScore - overlapPenalty;
}

function randomSchedule(courses) {
  return courses.map((course) => {
    const section = pickRandomSection(course);
    return {
      ...cloneCourse(course),
      selectedSectionId: section.id,
    };
  });
}

app.get("/courses", (_req, res) => {
  res.json({ courses: COURSE_DATA.map((course) => cloneCourse(course)) });
});

app.post("/addCourse", (req, res) => {
  const courseNumber = String(req.body?.courseNumber || "").trim();

  if (!courseNumber) {
    return res.status(400).json({ error: "courseNumber is required." });
  }

  const course = COURSE_DATA.find(
    (item) => item.courseNumber.toLowerCase() === courseNumber.toLowerCase(),
  );

  if (!course) {
    return res
      .status(404)
      .json({ error: `Course "${courseNumber}" was not found.` });
  }

  const courseWithDefaultSection = {
    ...cloneCourse(course),
    selectedSectionId: course.sections[0].id,
  };

  return res.json({ course: courseWithDefaultSection });
});

app.post("/optimize", (req, res) => {
  const preference = req.body?.preference === "spread" ? "spread" : "packed";
  const inputCourses = Array.isArray(req.body?.courses) ? req.body.courses : [];
  const selectedCourseNumbers = inputCourses
    .map((item) => item?.courseNumber)
    .filter(Boolean);

  const uniqueCourseNumbers = [...new Set(selectedCourseNumbers)];
  const coursesToSchedule = uniqueCourseNumbers
    .map((courseNumber) =>
      COURSE_DATA.find(
        (course) =>
          course.courseNumber.toLowerCase() === String(courseNumber).toLowerCase(),
      ),
    )
    .filter(Boolean);

  if (coursesToSchedule.length === 0) {
    return res.status(400).json({ error: "At least one valid course is required." });
  }

  const maxDurationMs = 3500;
  const startTime = Date.now();

  let bestSchedule = randomSchedule(coursesToSchedule);
  let bestScore = scoreSchedule(bestSchedule, preference);
  let iterations = 1;

  while (Date.now() - startTime < maxDurationMs) {
    // Sample many valid section combinations and keep the best one.
    const candidate = randomSchedule(coursesToSchedule);
    const candidateScore = scoreSchedule(candidate, preference);
    iterations += 1;

    if (candidateScore > bestScore) {
      bestSchedule = candidate;
      bestScore = candidateScore;
    }
  }

  return res.json({
    preference,
    score: bestScore,
    iterations,
    schedule: bestSchedule,
  });
});

app.post("/chat", async (req, res) => {
  const message = String(req.body?.message || "").trim();
  const schedule = Array.isArray(req.body?.schedule) ? req.body.schedule : [];

  if (!message) {
    return res.status(400).json({ error: "message is required." });
  }

  const scheduleSummary = schedule.length
    ? schedule
        .map((course) => {
          const section = course.sections?.find(
            (entry) => entry.id === course.selectedSectionId,
          );
          if (!section) {
            return `${course.courseNumber} ${course.name}: section not selected`;
          }

          return `${course.courseNumber} ${course.name} - Section ${section.id} (${section.days.join(
            ", ",
          )} ${formatHour(section.start)}-${formatHour(section.end)})`;
        })
        .join("\n")
    : "No courses in schedule.";

  if (!process.env.OPENAI_API_KEY) {
    return res.json({
      reply:
        "I can help with your schedule, but OPENAI_API_KEY is missing on the backend. Add it to backend/.env to enable live LLM replies.",
    });
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a helpful academic schedule assistant. Give concise, practical advice based on the provided schedule.",
        },
        {
          role: "user",
          content: `Current schedule:\n${scheduleSummary}\n\nUser question: ${message}`,
        },
      ],
    });

    return res.json({
      reply:
        response.output_text ||
        "I reviewed your schedule, but I could not generate a response.",
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to get chat response.",
      detail: error.message,
    });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend server running on http://localhost:${PORT}`);
});
