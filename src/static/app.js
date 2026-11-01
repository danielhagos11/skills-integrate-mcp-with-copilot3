document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const categoryFilter = document.getElementById("category-filter");
  const searchInput = document.getElementById("activity-search");
  const sortSelect = document.getElementById("sort-order");
  const authButton = document.getElementById("auth-button");
  const loginDialog = document.getElementById("login-dialog");
  const loginForm = document.getElementById("login-form");
  const signupDialog = document.getElementById("signup-dialog");
  const signupForm = document.getElementById("signup-form");
  const signupActivity = document.getElementById("signup-activity");
  const messageDiv = document.getElementById("message");
  let activities = {};
  let currentTeacher = null;
  let messageTimeout;

  function showMessage(message, type) {
    window.clearTimeout(messageTimeout);
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");
    messageTimeout = window.setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function showDialogError(dialog, message) {
    const feedback = dialog.querySelector(".dialog-feedback");
    feedback.textContent = message;
    feedback.classList.remove("hidden");
  }

  function clearDialogError(dialog) {
    const feedback = dialog.querySelector(".dialog-feedback");
    feedback.textContent = "";
    feedback.classList.add("hidden");
  }

  async function responseData(response) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.detail || "The request could not be completed.");
    }
    return data;
  }

  function createParticipant(email, activityName) {
    const item = document.createElement("li");
    const address = document.createElement("span");
    address.className = "participant-email";
    address.textContent = email;
    item.append(address);

    if (currentTeacher) {
      const unregisterButton = document.createElement("button");
      unregisterButton.className = "unregister-button";
      unregisterButton.type = "button";
      unregisterButton.textContent = "Remove";
      unregisterButton.setAttribute(
        "aria-label",
        `Unregister ${email} from ${activityName}`,
      );
      unregisterButton.addEventListener("click", () => {
        unregisterStudent(activityName, email);
      });
      item.append(unregisterButton);
    }
    return item;
  }

  function createActivityCard(name, details) {
    const card = document.createElement("article");
    card.className = "activity-card";

    const category = document.createElement("span");
    category.className = "category-tag";
    category.textContent = details.category;

    const heading = document.createElement("h3");
    heading.textContent = name;

    const description = document.createElement("p");
    description.className = "activity-description";
    description.textContent = details.description;

    const schedule = document.createElement("p");
    schedule.className = "activity-schedule";
    schedule.innerHTML = "<strong>Schedule:</strong> ";
    schedule.append(document.createTextNode(details.schedule));

    const spots = details.max_participants - details.participants.length;
    const availability = document.createElement("p");
    availability.className = "availability";
    availability.textContent =
      spots > 0 ? `${spots} spots available` : "Activity is full";

    const participants = document.createElement("section");
    participants.className = "participants-section";
    const participantsHeading = document.createElement("h4");
    participantsHeading.textContent = `Participants (${details.participants.length})`;
    const participantList = document.createElement("ul");
    participantList.className = "participants-list";

    if (details.participants.length) {
      details.participants.forEach((email) => {
        participantList.append(createParticipant(email, name));
      });
    } else {
      const emptyState = document.createElement("li");
      emptyState.className = "empty-participants";
      emptyState.textContent = "No students registered yet.";
      participantList.append(emptyState);
    }
    participants.append(participantsHeading, participantList);

    const registerButton = document.createElement("button");
    registerButton.className = "register-button";
    registerButton.type = "button";
    registerButton.textContent = "Register student";
    registerButton.disabled = !currentTeacher || spots <= 0;
    registerButton.title = currentTeacher
      ? spots > 0
        ? "Register a student for this activity"
        : "This activity is full"
      : "Teacher login is required";
    registerButton.addEventListener("click", () => {
      signupActivity.value = name;
      signupDialog.showModal();
      document.getElementById("student-email").focus();
    });

    card.append(category, heading, description, schedule, availability, participants);
    const actions = document.createElement("div");
    actions.className = "activity-actions";
    actions.append(registerButton);
    card.append(actions);
    return card;
  }

  function renderActivities() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase();
    const selectedCategory = categoryFilter.value;
    const sortOrder = sortSelect.value;

    const filteredActivities = Object.entries(activities).filter(
      ([name, details]) => {
        const searchableText = [
          name,
          details.description,
          details.schedule,
          details.category,
        ]
          .join(" ")
          .toLocaleLowerCase();
        return (
          (!selectedCategory || details.category === selectedCategory) &&
          (!searchTerm || searchableText.includes(searchTerm))
        );
      },
    );

    filteredActivities.sort(([nameA, detailsA], [nameB, detailsB]) => {
      if (sortOrder === "earliest") {
        return (
          detailsA.sort_time.localeCompare(detailsB.sort_time) ||
          nameA.localeCompare(nameB)
        );
      }
      if (sortOrder === "latest") {
        return (
          detailsB.sort_time.localeCompare(detailsA.sort_time) ||
          nameA.localeCompare(nameB)
        );
      }
      return nameA.localeCompare(nameB);
    });

    activitiesList.replaceChildren();
    if (!filteredActivities.length) {
      const emptyState = document.createElement("p");
      emptyState.className = "empty-state";
      emptyState.textContent = "No activities match those filters.";
      activitiesList.append(emptyState);
      return;
    }

    filteredActivities.forEach(([name, details]) => {
      activitiesList.append(createActivityCard(name, details));
    });
  }

  function updateAuthButton() {
    authButton.textContent = currentTeacher
      ? `👤 ${currentTeacher} · Sign out`
      : "👤 Teacher sign in";
    authButton.setAttribute(
      "aria-label",
      currentTeacher ? `Sign out ${currentTeacher}` : "Teacher sign in",
    );
    renderActivities();
  }

  async function fetchActivities() {
    activitiesList.textContent = "Loading activities…";
    try {
      const response = await fetch("/activities");
      activities = await responseData(response);

      const selectedCategory = categoryFilter.value;
      const categories = [...new Set(
        Object.values(activities).map((activity) => activity.category),
      )].sort((a, b) => a.localeCompare(b));
      categoryFilter.replaceChildren(new Option("All categories", ""));
      categories.forEach((category) => {
        categoryFilter.add(new Option(category, category));
      });
      if (categories.includes(selectedCategory)) {
        categoryFilter.value = selectedCategory;
      }
      signupActivity.replaceChildren(
        ...Object.keys(activities).map((name) => new Option(name, name)),
      );
      renderActivities();
    } catch (error) {
      activitiesList.textContent = "Activities could not be loaded. Please try again.";
      console.error("Error fetching activities:", error);
    }
  }

  async function fetchAuthState() {
    try {
      const response = await fetch("/auth/me");
      const data = await responseData(response);
      currentTeacher = data.username;
      updateAuthButton();
    } catch (error) {
      showMessage("Could not check the teacher login. Refresh to try again.", "error");
      console.error("Error checking teacher login:", error);
    }
  }

  async function unregisterStudent(activity, email) {
    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        { method: "DELETE" },
      );
      const result = await responseData(response);
      showMessage(result.message, "success");
      await fetchActivities();
    } catch (error) {
      showMessage(error.message || "Failed to unregister the student.", "error");
      console.error("Error unregistering student:", error);
    }
  }

  authButton.addEventListener("click", async () => {
    if (!currentTeacher) {
      loginDialog.showModal();
      document.getElementById("teacher-username").focus();
      return;
    }

    try {
      const response = await fetch("/auth/logout", { method: "POST" });
      await responseData(response);
      currentTeacher = null;
      updateAuthButton();
      showMessage("You have signed out.", "info");
    } catch (error) {
      showMessage(error.message || "Could not sign out.", "error");
      console.error("Error signing out:", error);
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearDialogError(loginDialog);
    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await responseData(response);
      currentTeacher = result.username;
      loginForm.reset();
      loginDialog.close();
      updateAuthButton();
      showMessage("Teacher signed in. Student registration is enabled.", "success");
    } catch (error) {
      showDialogError(loginDialog, error.message || "Could not sign in.");
      console.error("Error signing in:", error);
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearDialogError(signupDialog);
    const email = document.getElementById("student-email").value;
    const activity = signupActivity.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        { method: "POST" },
      );
      const result = await responseData(response);
      signupForm.reset();
      signupDialog.close();
      showMessage(result.message, "success");
      await fetchActivities();
    } catch (error) {
      showDialogError(
        signupDialog,
        error.message || "Failed to register the student.",
      );
      console.error("Error registering student:", error);
    }
  });

  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => {
      button.closest("dialog").close();
    });
  });
  [categoryFilter, searchInput, sortSelect].forEach((control) => {
    control.addEventListener("input", renderActivities);
    control.addEventListener("change", renderActivities);
  });

  Promise.all([fetchAuthState(), fetchActivities()]);
});
