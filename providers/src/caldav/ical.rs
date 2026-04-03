use icalendar::{Calendar, CalendarComponent, Component, Event, EventLike, Todo, TodoStatus};
use serde::{Deserialize, Serialize};

// Internal iCalendar types — only used within the caldav provider.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VTodo {
    pub uid: String,
    pub summary: String,
    pub description: Option<String>,
    pub due: Option<String>,
    pub priority: Option<u32>,
    pub categories: Vec<String>,
    pub status: Option<String>,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub rrule: Option<String>,
    pub related_to: Option<String>,
    pub notes: Option<String>,
    pub time_estimate: Option<i64>,
    pub source_event_uid: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VEvent {
    pub uid: String,
    pub summary: String,
    pub description: Option<String>,
    pub dtstart: Option<String>,
    pub dtend: Option<String>,
    pub location: Option<String>,
    pub color: Option<String>,
    /// Set by Tasky via X-TASKY-COMPLETED
    pub completed: bool,
    /// Set by Tasky via X-TASKY-PRIORITY (e.g. "high", "medium", "low")
    pub priority: Option<String>,
    /// Set by Tasky via X-TASKY-NOTES
    pub notes: Option<String>,
    /// Set by Tasky via X-TASKY-TIME-ESTIMATE (minutes)
    pub time_estimate: Option<i64>,
    /// Set via CATEGORIES property
    pub categories: Vec<String>,
}

pub fn parse_vtodos(ical_text: &str) -> Vec<VTodo> {
    let Ok(calendar) = ical_text.parse::<Calendar>() else {
        return vec![];
    };

    let mut todos = Vec::new();
    for component in &calendar.components {
        if let CalendarComponent::Todo(todo) = component {
            if let Some(vtodo) = todo_to_vtodo(todo) {
                todos.push(vtodo);
            }
        }
    }
    todos
}

fn todo_to_vtodo(todo: &Todo) -> Option<VTodo> {
    let uid = todo.get_uid()?.to_string();
    let summary = todo.get_summary().unwrap_or("").to_string();
    let description = todo.get_description().map(|s| s.to_string());

    let due = todo.get_due().map(|dt| {
        use icalendar::DatePerhapsTime;
        match dt {
            DatePerhapsTime::DateTime(d) => {
                use icalendar::CalendarDateTime;
                match d {
                    CalendarDateTime::Floating(naive) => naive.to_string(),
                    CalendarDateTime::Utc(utc) => utc.to_rfc3339(),
                    CalendarDateTime::WithTimezone { date_time, tzid: _ } => date_time.to_string(),
                }
            }
            DatePerhapsTime::Date(d) => d.to_string(),
        }
    });

    let priority = todo.get_priority();

    let categories: Vec<String> = todo
        .multi_properties()
        .get("CATEGORIES")
        .map(|props| {
            props
                .iter()
                .flat_map(|p| p.value().split(','))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_else(|| {
            todo.property_value("CATEGORIES")
                .map(|raw| {
                    raw.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default()
        });

    let (completed, status) = match todo.get_status() {
        Some(TodoStatus::Completed) => (true, Some("COMPLETED".to_string())),
        Some(TodoStatus::InProcess) => (false, Some("IN-PROCESS".to_string())),
        Some(TodoStatus::Cancelled) => (false, Some("CANCELLED".to_string())),
        _ => (false, Some("NEEDS-ACTION".to_string())),
    };

    let rrule = todo.property_value("RRULE").map(|s| s.to_string());
    let related_to = todo.property_value("RELATED-TO").map(|s| s.to_string());
    let notes = todo.property_value("X-TASKY-NOTES").map(|s| s.to_string());
    let time_estimate = todo
        .property_value("X-TASKY-TIME-ESTIMATE")
        .and_then(|s| s.parse::<i64>().ok());
    let completed_at = todo.property_value("COMPLETED").map(|s| s.to_string());
    let source_event_uid = todo
        .property_value("X-TASKY-SOURCE-EVENT-UID")
        .map(|s| s.to_string());

    Some(VTodo {
        uid,
        summary,
        description,
        due,
        priority,
        categories,
        status,
        completed,
        completed_at,
        rrule,
        related_to,
        notes,
        time_estimate,
        source_event_uid,
    })
}

pub fn vtodo_to_ical(vtodo: &VTodo) -> String {
    let mut todo = Todo::new();

    todo.uid(&vtodo.uid);
    todo.summary(&vtodo.summary);

    if let Some(desc) = &vtodo.description {
        todo.description(desc);
    }
    if let Some(p) = vtodo.priority {
        todo.priority(p);
    }
    if !vtodo.categories.is_empty() {
        todo.add_property("CATEGORIES", &vtodo.categories.join(","));
    }
    if vtodo.completed {
        todo.status(TodoStatus::Completed);
    } else {
        todo.status(TodoStatus::NeedsAction);
    }
    if let Some(due) = &vtodo.due {
        if due.contains('T') {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(due) {
                todo.due(dt.with_timezone(&chrono::Utc));
            } else {
                todo.add_property("DUE", due);
            }
        } else if let Ok(d) = chrono::NaiveDate::parse_from_str(due, "%Y-%m-%d") {
            todo.due(d);
        } else {
            todo.add_property("DUE", due);
        }
    }
    if let Some(ca) = &vtodo.completed_at {
        let formatted = chrono::DateTime::parse_from_rfc3339(ca)
            .map(|dt| {
                dt.with_timezone(&chrono::Utc)
                    .format("%Y%m%dT%H%M%SZ")
                    .to_string()
            })
            .unwrap_or_else(|_| ca.clone());
        todo.add_property("COMPLETED", &formatted);
    }
    if let Some(rrule) = &vtodo.rrule {
        todo.add_property("RRULE", rrule);
    }
    if let Some(rt) = &vtodo.related_to {
        todo.add_property("RELATED-TO", rt);
    }
    if let Some(notes) = &vtodo.notes {
        todo.add_property("X-TASKY-NOTES", notes);
    }
    if let Some(te) = vtodo.time_estimate {
        todo.add_property("X-TASKY-TIME-ESTIMATE", &te.to_string());
    }
    if let Some(seu) = &vtodo.source_event_uid {
        todo.add_property("X-TASKY-SOURCE-EVENT-UID", seu);
    }

    let calendar = Calendar::new().push(todo).done();
    calendar.to_string()
}

pub fn parse_vevents(ical_text: &str) -> Vec<VEvent> {
    let Ok(calendar) = ical_text.parse::<Calendar>() else {
        return vec![];
    };

    let mut events = Vec::new();
    for component in &calendar.components {
        if let CalendarComponent::Event(event) = component {
            if let Some(vevent) = event_to_vevent(event) {
                events.push(vevent);
            }
        }
    }
    events
}

fn event_to_vevent(event: &Event) -> Option<VEvent> {
    let uid = event.get_uid()?.to_string();
    let summary = event.get_summary().unwrap_or("").to_string();
    let description = event.get_description().map(|s| s.to_string());
    let location = event.get_location().map(|s| s.to_string());
    let color = event.property_value("COLOR").map(|s| s.to_string());

    let dtstart = event.get_start().map(|dt| {
        use icalendar::DatePerhapsTime;
        match dt {
            DatePerhapsTime::DateTime(d) => {
                use icalendar::CalendarDateTime;
                match d {
                    CalendarDateTime::Floating(naive) => naive.to_string(),
                    CalendarDateTime::Utc(utc) => utc.to_rfc3339(),
                    CalendarDateTime::WithTimezone { date_time, tzid: _ } => date_time.to_string(),
                }
            }
            DatePerhapsTime::Date(d) => d.to_string(),
        }
    });

    let dtend = event.get_end().map(|dt| {
        use icalendar::DatePerhapsTime;
        match dt {
            DatePerhapsTime::DateTime(d) => {
                use icalendar::CalendarDateTime;
                match d {
                    CalendarDateTime::Floating(naive) => naive.to_string(),
                    CalendarDateTime::Utc(utc) => utc.to_rfc3339(),
                    CalendarDateTime::WithTimezone { date_time, tzid: _ } => date_time.to_string(),
                }
            }
            DatePerhapsTime::Date(d) => d.to_string(),
        }
    });

    let completed = event
        .property_value("X-TASKY-COMPLETED")
        .map(|s| s.eq_ignore_ascii_case("TRUE"))
        .unwrap_or(false);
    let priority = event
        .property_value("X-TASKY-PRIORITY")
        .map(|s| s.to_string());
    let notes = event.property_value("X-TASKY-NOTES").map(|s| s.to_string());
    let time_estimate = event
        .property_value("X-TASKY-TIME-ESTIMATE")
        .and_then(|s| s.parse::<i64>().ok());

    let categories: Vec<String> = event
        .multi_properties()
        .get("CATEGORIES")
        .map(|props| {
            props
                .iter()
                .flat_map(|p| p.value().split(','))
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_else(|| {
            event
                .property_value("CATEGORIES")
                .map(|raw| {
                    raw.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_default()
        });

    Some(VEvent {
        uid,
        summary,
        description,
        dtstart,
        dtend,
        location,
        color,
        completed,
        priority,
        notes,
        time_estimate,
        categories,
    })
}

// ── VEVENT write-back ─────────────────────────────────────────────────────────

/// Read-modify-write a VEVENT iCal string, overlaying Tasky-managed properties
/// while preserving all server-side fields (ATTENDEE, RRULE, TZID, etc.).
pub fn vevent_to_ical(existing_ical: &str, updates: &crate::EventPushInput) -> String {
    // Properties fully managed by Tasky — existing values are removed and replaced.
    const TASKY_MANAGED: &[&str] = &[
        "SUMMARY",
        "DESCRIPTION",
        "CATEGORIES",
        "X-TASKY-COMPLETED",
        "X-TASKY-PRIORITY",
        "X-TASKY-NOTES",
        "X-TASKY-TIME-ESTIMATE",
    ];

    if existing_ical.trim().is_empty() {
        return build_minimal_vevent(updates);
    }

    // Unfold RFC 5545 line continuations before processing.
    let unfolded = unfold_ical(existing_ical);

    // DTSTART / DTEND are replaced only when we have new values.
    let replace_dtstart = updates.dtstart.is_some();
    let replace_dtend = updates.dtend.is_some();

    let filtered_lines: Vec<&str> = unfolded
        .lines()
        .filter(|line| {
            let prop_name = line
                .split(|c| c == ':' || c == ';')
                .next()
                .unwrap_or("")
                .to_ascii_uppercase();
            let is_tasky = TASKY_MANAGED.contains(&prop_name.as_str());
            let is_dtstart = prop_name == "DTSTART" && replace_dtstart;
            let is_dtend = prop_name == "DTEND" && replace_dtend;
            !is_tasky && !is_dtstart && !is_dtend
        })
        .collect();

    // Build replacement property lines.
    let mut new_lines: Vec<String> = Vec::new();
    new_lines.push(format!("SUMMARY:{}", escape_ical_text(&updates.title)));
    if let Some(desc) = &updates.description {
        if !desc.is_empty() {
            new_lines.push(format!("DESCRIPTION:{}", escape_ical_text(desc)));
        }
    }
    if let Some(dtstart) = &updates.dtstart {
        new_lines.push(ical_datetime_prop("DTSTART", dtstart));
    }
    if let Some(dtend) = &updates.dtend {
        new_lines.push(ical_datetime_prop("DTEND", dtend));
    }
    if !updates.tags.is_empty() {
        let escaped: Vec<String> = updates.tags.iter().map(|t| escape_ical_text(t)).collect();
        new_lines.push(format!("CATEGORIES:{}", escaped.join(",")));
    }
    if updates.completed {
        new_lines.push("X-TASKY-COMPLETED:TRUE".to_string());
    }
    new_lines.push(format!(
        "X-TASKY-PRIORITY:{}",
        escape_ical_text(&updates.priority)
    ));
    if let Some(notes) = &updates.notes {
        if !notes.is_empty() {
            new_lines.push(format!("X-TASKY-NOTES:{}", escape_ical_text(notes)));
        }
    }
    if let Some(te) = updates.time_estimate {
        new_lines.push(format!("X-TASKY-TIME-ESTIMATE:{}", te));
    }

    // Insert new lines just before END:VEVENT.
    let mut result_lines: Vec<String> = Vec::new();
    for line in &filtered_lines {
        if line.trim().eq_ignore_ascii_case("END:VEVENT") {
            result_lines.extend(new_lines.iter().cloned());
        }
        result_lines.push(line.to_string());
    }

    // Ensure CRLF line endings and trailing newline.
    let mut output = result_lines.join("\r\n");
    if !output.ends_with("\r\n") {
        output.push_str("\r\n");
    }
    output
}

fn unfold_ical(ical: &str) -> String {
    // RFC 5545 §3.1: CRLF followed by a whitespace character is a line fold.
    ical.replace("\r\n ", "")
        .replace("\r\n\t", "")
        // Also handle bare LF (some servers omit CR).
        .replace("\n ", "")
        .replace("\n\t", "")
}

fn escape_ical_text(s: &str) -> String {
    // RFC 5545 TEXT escaping.
    s.replace('\\', "\\\\")
        .replace('\n', "\\n")
        .replace(';', "\\;")
        .replace(',', "\\,")
}

fn ical_datetime_prop(name: &str, iso: &str) -> String {
    // Convert ISO 8601 to iCal UTC format, or date-only, or pass through.
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(iso) {
        let utc = dt.with_timezone(&chrono::Utc);
        format!("{}:{}", name, utc.format("%Y%m%dT%H%M%SZ"))
    } else if let Ok(d) = chrono::NaiveDate::parse_from_str(iso, "%Y-%m-%d") {
        format!("{}:{}", name, d.format("%Y%m%d"))
    } else {
        format!("{}:{}", name, iso)
    }
}

fn build_minimal_vevent(updates: &crate::EventPushInput) -> String {
    let mut lines = vec![
        "BEGIN:VCALENDAR".to_string(),
        "VERSION:2.0".to_string(),
        "PRODID:-//Tasky//EN".to_string(),
        "BEGIN:VEVENT".to_string(),
        format!("UID:{}", updates.event_uid),
    ];
    if let Some(dtstart) = &updates.dtstart {
        lines.push(ical_datetime_prop("DTSTART", dtstart));
    }
    if let Some(dtend) = &updates.dtend {
        lines.push(ical_datetime_prop("DTEND", dtend));
    }
    lines.push(format!("SUMMARY:{}", escape_ical_text(&updates.title)));
    if let Some(desc) = &updates.description {
        if !desc.is_empty() {
            lines.push(format!("DESCRIPTION:{}", escape_ical_text(desc)));
        }
    }
    if !updates.tags.is_empty() {
        let escaped: Vec<String> = updates.tags.iter().map(|t| escape_ical_text(t)).collect();
        lines.push(format!("CATEGORIES:{}", escaped.join(",")));
    }
    if updates.completed {
        lines.push("X-TASKY-COMPLETED:TRUE".to_string());
    }
    lines.push(format!("X-TASKY-PRIORITY:{}", updates.priority));
    if let Some(notes) = &updates.notes {
        if !notes.is_empty() {
            lines.push(format!("X-TASKY-NOTES:{}", escape_ical_text(notes)));
        }
    }
    if let Some(te) = updates.time_estimate {
        lines.push(format!("X-TASKY-TIME-ESTIMATE:{}", te));
    }
    lines.push("END:VEVENT".to_string());
    lines.push("END:VCALENDAR".to_string());
    let mut output = lines.join("\r\n");
    output.push_str("\r\n");
    output
}
