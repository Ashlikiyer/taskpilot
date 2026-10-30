/**
 * TaskPilot email intake (Google Apps Script).
 *
 * Every 5 minutes, sends each unread message under a "TaskPilot/..." Gmail label to
 * TaskPilot, which turns it into a task proposal in the matching project's Inbox.
 * A message is marked read only after TaskPilot accepts it, so nothing is lost if
 * the server is asleep or down.
 *
 * Setup (see the README, "Email intake"):
 *   1. Project Settings > Script properties:
 *        WEBHOOK_URL    https://<your-frontend>/api/v1/intake/email
 *        INTAKE_SECRET  the same value as INTAKE_SECRET on the backend
 *        LABEL_PREFIX   optional, defaults to "TaskPilot/"
 *   2. Run installTrigger() once and approve the Gmail permissions.
 */

var MAX_BODY_CHARS = 100000;
var MAX_THREADS_PER_LABEL = 50;

function forwardLabeledEmails() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('INTAKE_SECRET');
  var prefix = props.getProperty('LABEL_PREFIX') || 'TaskPilot/';
  if (!url || !secret) {
    throw new Error('Set WEBHOOK_URL and INTAKE_SECRET in the script properties.');
  }

  var labels = GmailApp.getUserLabels().filter(function (label) {
    return label.getName().indexOf(prefix) === 0;
  });

  labels.forEach(function (label) {
    var threads = label.getThreads(0, MAX_THREADS_PER_LABEL);
    threads.forEach(function (thread) {
      thread.getMessages().forEach(function (message) {
        if (!message.isUnread()) return;
        var status = send_(url, secret, label.getName(), message);
        if (status === 401) {
          throw new Error('TaskPilot rejected the INTAKE_SECRET. Check the script properties.');
        }
        if (status >= 200 && status < 300) {
          message.markRead(); // 200 also covers "already received" duplicates
        } else {
          console.warn('Not delivered (HTTP ' + status + '); will retry: ' + message.getSubject());
        }
      });
    });
  });
}

function send_(url, secret, labelName, message) {
  var payload = {
    message_id: message.getId(),
    subject: message.getSubject() || '',
    body: (message.getPlainBody() || '').slice(0, MAX_BODY_CHARS),
    sender: message.getFrom(),
    received_at: message.getDate().toISOString(),
    label: labelName,
  };
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Intake-Secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  return response.getResponseCode();
}

/** Run once to check for new emails every 5 minutes. */
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'forwardLabeledEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('forwardLabeledEmails').timeBased().everyMinutes(5).create();
}
