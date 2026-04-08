import { useMemo, useState } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001'
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const START_HOUR = 9
const END_HOUR = 18
const TOTAL_HOURS = END_HOUR - START_HOUR
const COURSE_STYLES = [
  { blockBg: 'bg-indigo-500', blockBorder: 'border-indigo-300', dot: 'bg-indigo-500' },
  { blockBg: 'bg-emerald-500', blockBorder: 'border-emerald-300', dot: 'bg-emerald-500' },
  { blockBg: 'bg-rose-500', blockBorder: 'border-rose-300', dot: 'bg-rose-500' },
  { blockBg: 'bg-amber-500', blockBorder: 'border-amber-300', dot: 'bg-amber-500' },
  { blockBg: 'bg-sky-500', blockBorder: 'border-sky-300', dot: 'bg-sky-500' },
  { blockBg: 'bg-violet-500', blockBorder: 'border-violet-300', dot: 'bg-violet-500' },
]

function formatDisplayTime(decimalHour) {
  const totalMinutes = Math.round(decimalHour * 60)
  const hour = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const hour12 = hour % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function getSection(course) {
  return course.sections.find((section) => section.id === course.selectedSectionId)
}

function sectionPosition(section) {
  return {
    top: `${((section.start - START_HOUR) / TOTAL_HOURS) * 100}%`,
    height: `${((section.end - section.start) / TOTAL_HOURS) * 100}%`,
  }
}

async function postJson(endpoint, payload) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || 'Request failed')
  }
  return data
}

function App() {
  const [courses, setCourses] = useState([])
  const [courseInput, setCourseInput] = useState('')
  const [openCourseNumber, setOpenCourseNumber] = useState(null)
  const [uiMessage, setUiMessage] = useState('')
  const [isAddingCourse, setIsAddingCourse] = useState(false)
  const [isOptimizeOpen, setIsOptimizeOpen] = useState(false)
  const [selectedPreference, setSelectedPreference] = useState('packed')
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatMessages, setChatMessages] = useState([])

  // Precompute course blocks by weekday for efficient rendering in the grid.
  const scheduleByDay = useMemo(() => {
    const byDay = Object.fromEntries(DAYS.map((day) => [day, []]))

    courses.forEach((course, index) => {
      const section = getSection(course)
      if (!section) {
        return
      }

      section.days.forEach((day) => {
        byDay[day].push({
          ...course,
          section,
          courseStyle: COURSE_STYLES[index % COURSE_STYLES.length],
        })
      })
    })

    return byDay
  }, [courses])

  const hourLabels = Array.from({ length: TOTAL_HOURS + 1 }, (_, index) => START_HOUR + index)

  const addWelcomeChatMessage = () => {
    setChatMessages((previous) => {
      if (previous.length > 0) {
        return previous
      }

      return [
        {
          role: 'assistant',
          text: "Hi! I'm your personal schedule assistant. Ask me anything about your schedule.",
        },
      ]
    })
  }

  const handleOpenChat = () => {
    setChatOpen((previous) => !previous)
    addWelcomeChatMessage()
  }

  const handleAddCourse = async () => {
    const normalizedInput = courseInput.trim()
    if (!normalizedInput) {
      setUiMessage('Please enter a course number.')
      return
    }

    if (
      courses.some(
        (course) =>
          course.courseNumber.toLowerCase() === normalizedInput.toLowerCase(),
      )
    ) {
      setUiMessage(`${normalizedInput} is already in your schedule.`)
      return
    }

    try {
      setIsAddingCourse(true)
      setUiMessage('')
      const data = await postJson('/addCourse', { courseNumber: normalizedInput })
      setCourses((previous) => [...previous, data.course])
      setCourseInput('')
      setUiMessage(`Added ${data.course.courseNumber}.`)
    } catch (error) {
      setUiMessage(error.message)
    } finally {
      setIsAddingCourse(false)
    }
  }

  const handleSectionChange = (courseNumber, sectionId) => {
    setCourses((previous) =>
      previous.map((course) =>
        course.courseNumber === courseNumber
          ? { ...course, selectedSectionId: sectionId }
          : course,
      ),
    )
  }

  const handleOptimize = async (preference) => {
    if (courses.length === 0) {
      setUiMessage('Add at least one course before optimizing.')
      setIsOptimizeOpen(false)
      return
    }

    try {
      setIsOptimizing(true)
      // Backend picks sections using random search based on preference.
      const data = await postJson('/optimize', { courses, preference })
      setCourses(data.schedule)
      setUiMessage(`Optimized for ${preference} classes.`)
    } catch (error) {
      setUiMessage(error.message)
    } finally {
      setIsOptimizing(false)
      setIsOptimizeOpen(false)
    }
  }

  const handleSendChat = async () => {
    const message = chatInput.trim()
    if (!message || chatSending) {
      return
    }

    setChatInput('')
    setChatMessages((previous) => [...previous, { role: 'user', text: message }])

    try {
      setChatSending(true)
      const data = await postJson('/chat', { schedule: courses, message })
      setChatMessages((previous) => [
        ...previous,
        { role: 'assistant', text: data.reply || 'No response generated.' },
      ])
    } catch (error) {
      setChatMessages((previous) => [
        ...previous,
        {
          role: 'assistant',
          text: `Chat error: ${error.message}`,
        },
      ])
    } finally {
      setChatSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto grid min-h-screen max-w-[1700px] gap-6 px-4 py-6 lg:grid-cols-[90px_minmax(0,1fr)_380px] xl:px-10">
        <div className="hidden lg:block" aria-hidden="true" />

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-lg md:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-white">Schedule Planner</h1>
            <p className="text-sm text-gray-400">Monday - Friday, 9:00 AM to 6:00 PM</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900/80">
            <div className="grid grid-cols-[76px_repeat(5,minmax(0,1fr))] border-b border-gray-800 bg-gray-800/70">
              <div className="p-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Time
              </div>
              {DAYS.map((day) => (
                <div
                  key={day}
                  className="border-l border-gray-800 p-3 text-center text-sm font-semibold text-gray-200"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid h-[630px] grid-cols-[76px_repeat(5,minmax(0,1fr))]">
              <div className="relative border-r border-gray-800 bg-gray-900">
                {hourLabels.map((hour) => (
                  <span
                    key={hour}
                    className="absolute -translate-y-1/2 pl-2 text-xs text-gray-400"
                    style={{ top: `${((hour - START_HOUR) / TOTAL_HOURS) * 100}%` }}
                  >
                    {formatDisplayTime(hour)}
                  </span>
                ))}
              </div>

              <div className="relative col-span-5 grid grid-cols-5">
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, lineIndex) => (
                  <div
                    key={lineIndex}
                    className="pointer-events-none absolute left-0 right-0 border-t border-gray-800/80"
                    style={{ top: `${(lineIndex / TOTAL_HOURS) * 100}%` }}
                  />
                ))}

                {DAYS.map((day) => (
                  <div key={day} className="relative border-l border-gray-800 last:border-r">
                    {(scheduleByDay[day] || []).map((course) => (
                      <div
                        key={`${course.courseNumber}-${course.selectedSectionId}-${day}`}
                        className={`absolute left-1.5 right-1.5 rounded-xl border p-2.5 text-xs text-white shadow-lg ring-1 ring-white/15 ${course.courseStyle.blockBg} ${course.courseStyle.blockBorder}`}
                        style={sectionPosition(course.section)}
                      >
                        <p className="font-semibold">{course.courseNumber}</p>
                        <p className="line-clamp-2">{course.name}</p>
                        <p className="mt-1 text-[10px] text-white/90">
                          {formatDisplayTime(course.section.start)} - {formatDisplayTime(course.section.end)}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="relative rounded-2xl border border-gray-800 bg-gray-900 p-5 shadow-lg md:p-6">
          <h2 className="text-lg font-semibold text-white">Course Selection</h2>

          <div className="mt-3 flex gap-2">
            <input
              value={courseInput}
              onChange={(event) => setCourseInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleAddCourse()
                }
              }}
              placeholder="e.g. 15-251"
              className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleAddCourse}
              disabled={isAddingCourse}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-60"
            >
              {isAddingCourse ? 'Adding...' : 'Add Course'}
            </button>
          </div>

          {uiMessage ? <p className="mt-2 text-sm text-gray-400">{uiMessage}</p> : null}

          <button
            type="button"
            onClick={() => {
              setSelectedPreference('packed')
              setIsOptimizeOpen(true)
            }}
            disabled={isOptimizing}
            className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 disabled:opacity-60"
          >
            {isOptimizing ? 'Optimizing...' : 'Optimize Schedule'}
          </button>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-300">Added Courses</h3>
            <div className="mt-3 space-y-3">
              {courses.length === 0 ? (
                <p className="text-sm text-gray-500">No courses added yet.</p>
              ) : (
                courses.map((course, index) => {
                  const selectedSection = getSection(course)
                  const courseStyle = COURSE_STYLES[index % COURSE_STYLES.length]
                  const isOpen = openCourseNumber === course.courseNumber
                  return (
                    <div
                      key={course.courseNumber}
                      className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800/70"
                    >
                      <button
                        type="button"
                        className="flex w-full items-start justify-between p-3 text-left hover:bg-gray-800"
                        onClick={() =>
                          setOpenCourseNumber((previous) =>
                            previous === course.courseNumber ? null : course.courseNumber,
                          )
                        }
                      >
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-gray-100">
                            <span className={`h-2.5 w-2.5 rounded-full ${courseStyle.dot}`} />
                            {course.courseNumber}
                          </p>
                          <p className="text-xs text-gray-400">{course.name}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          Sec {selectedSection?.id || '-'}
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-gray-700 p-3">
                          <label className="mb-1 block text-xs font-medium text-gray-400">
                            Choose section
                          </label>
                          <select
                            value={course.selectedSectionId}
                            onChange={(event) =>
                              handleSectionChange(course.courseNumber, event.target.value)
                            }
                            className="w-full rounded-md border border-gray-700 bg-gray-900 px-2 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
                          >
                            {course.sections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.id} - {section.days.join('/')} {formatDisplayTime(section.start)}
                                {' - '}
                                {formatDisplayTime(section.end)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </aside>
      </div>

      {isOptimizeOpen ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-5 shadow-lg">
            <h3 className="text-lg font-semibold text-white">Optimize Schedule</h3>
            <p className="mt-2 text-sm text-gray-400">
              Do you prefer classes packed together or spread apart?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPreference('packed')}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  selectedPreference === 'packed'
                    ? 'border-blue-400 bg-blue-600 text-white'
                    : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                Packed
              </button>
              <button
                type="button"
                onClick={() => setSelectedPreference('spread')}
                className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                  selectedPreference === 'spread'
                    ? 'border-blue-400 bg-blue-600 text-white'
                    : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
                }`}
              >
                Spread
              </button>
            </div>

            <button
              type="button"
              onClick={() => handleOptimize(selectedPreference)}
              className="mt-4 w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Confirm
            </button>
            <button
              type="button"
              className="mt-2 w-full rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
              onClick={() => setIsOptimizeOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleOpenChat}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl text-white shadow-lg hover:bg-blue-500"
        aria-label="Open schedule assistant chat"
      >
        💬
      </button>

      {chatOpen ? (
        <div className="fixed bottom-24 right-6 z-40 flex h-[470px] w-[350px] flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-xl">
          <div className="bg-gray-800 px-4 py-3 text-sm font-semibold text-gray-100">Schedule Assistant</div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-900 p-3">
            {chatMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-100'
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="flex gap-2 border-t border-gray-700 p-3">
            <input
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handleSendChat()
                }
              }}
              placeholder="Ask about your schedule..."
              className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={chatSending}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {chatSending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
