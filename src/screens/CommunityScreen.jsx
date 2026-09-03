import AnnouncementFeed from '../components/AnnouncementFeed.jsx'
import TodoList from '../components/TodoList.jsx'
import Calendar from '../components/Calendar.jsx'

// Community screen — shared by everyone. Anyone can post announcements, add
// to-do tasks, and create calendar events. Admins get delete controls.
export default function CommunityScreen({
  session,
  announcements = [],
  todos = [],
  events = [],
  postAnnouncement,
  addTodo,
  toggleTodo,
  deleteTodo,
  addEvent,
  deleteEvent,
}) {
  const isAdmin = session?.role === 'admin'

  return (
    <div className="space-y-4">
      <AnnouncementFeed
        announcements={announcements}
        onPost={(text) => postAnnouncement(text)}
        onPostPrebuilt={(text) => postAnnouncement(text)}
        isAdmin={isAdmin}
      />
      <TodoList
        todos={todos}
        onAdd={(todo) => addTodo(todo)}
        onToggle={(id) => toggleTodo(id)}
        onDelete={isAdmin ? (id) => deleteTodo(id) : null}
      />
      <Calendar
        events={events}
        onAdd={(event) => addEvent(event)}
        onDelete={isAdmin ? (id) => deleteEvent(id) : null}
      />
    </div>
  )
}
