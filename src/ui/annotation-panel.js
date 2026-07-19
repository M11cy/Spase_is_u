const setText = (element, value) => {
  element.textContent = value ?? "";
};

export function createAnnotationPanel({ panel, closeButton, fields, onSolveQuiz }) {
  const documentRef = panel.ownerDocument;
  const quizRoot = fields.quiz ?? null;
  let trigger = null;
  let disposed = false;

  const setPanelOpen = (isOpen) => {
    documentRef.body?.classList.toggle("panel-open", isOpen);
  };

  const close = () => {
    if (panel.hidden) return;

    panel.hidden = true;
    panel.classList.remove("open");
    panel.classList.remove("has-quiz");
    setPanelOpen(false);
    if (quizRoot) quizRoot.replaceChildren();
    const returnTarget = trigger;
    trigger = null;
    if (returnTarget?.isConnected) returnTarget.focus();
  };

  const onCloseClick = (event) => {
    event.stopPropagation();
    close();
  };

  const onKeyDown = (event) => {
    if (event.key !== "Escape" || panel.hidden) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };

  const answerQuiz = (data, index, button, feedback) => {
    if (index === data.quiz.answer) {
      quizRoot.dataset.state = "solved";
      quizRoot.querySelectorAll(".panel-quiz__option").forEach((option) => {
        option.disabled = true;
      });
      button.classList.add("correct");
      feedback.textContent = "Верно! Деталь двигателя найдена.";
      onSolveQuiz?.(data);
    } else {
      button.classList.add("wrong");
      button.disabled = true;
      feedback.textContent = "Не то. Подсказка — в описании планеты. Попробуй ещё.";
    }
  };

  const renderQuiz = (data) => {
    if (!quizRoot) return;
    quizRoot.replaceChildren();

    if (!data.quiz) {
      quizRoot.hidden = true;
      delete quizRoot.dataset.state;
      return;
    }

    quizRoot.hidden = false;

    if (data.quizSolved) {
      quizRoot.dataset.state = "solved";
      const done = documentRef.createElement("p");
      done.className = "panel-quiz__done";
      done.textContent = "Деталь двигателя уже найдена ✓";
      quizRoot.append(done);
      return;
    }

    quizRoot.dataset.state = "asking";
    const question = documentRef.createElement("p");
    question.className = "panel-quiz__question";
    question.textContent = data.quiz.question;

    const options = documentRef.createElement("div");
    options.className = "panel-quiz__options";

    const feedback = documentRef.createElement("p");
    feedback.className = "panel-quiz__feedback";
    feedback.setAttribute("aria-live", "polite");

    data.quiz.options.forEach((label, index) => {
      const option = documentRef.createElement("button");
      option.type = "button";
      option.className = "panel-quiz__option";
      option.textContent = label;
      option.addEventListener("click", (event) => {
        event.stopPropagation();
        answerQuiz(data, index, option, feedback);
      });
      options.append(option);
    });

    quizRoot.append(question, options, feedback);
  };

  closeButton.addEventListener("click", onCloseClick);
  documentRef.addEventListener("keydown", onKeyDown);

  const open = (data, source = documentRef.activeElement) => {
    if (disposed) return;

    trigger = source;
    panel.hidden = false;
    panel.classList.add("open");
    panel.classList.toggle("no-image", !data.image);
    panel.classList.toggle("has-quiz", Boolean(data.quiz));
    setPanelOpen(true);

    fields.image.hidden = !data.image;
    if (data.image) {
      fields.image.src = data.image;
      fields.image.alt = data.title ?? "";
    } else {
      fields.image.removeAttribute("src");
      fields.image.alt = "";
    }

    setText(fields.scale, data.scale);
    setText(fields.title, data.title);
    setText(fields.text, data.text);
    setText(fields.discovery, data.discovery);
    setText(fields.distance, data.distance);
    renderQuiz(data);
    closeButton.focus();
  };

  const dispose = () => {
    if (disposed) return;
    close();
    closeButton.removeEventListener("click", onCloseClick);
    documentRef.removeEventListener("keydown", onKeyDown);
    disposed = true;
  };

  return Object.freeze({ open, close, dispose });
}
