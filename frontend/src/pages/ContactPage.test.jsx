import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactPage } from "./ContactPage";

const sendContactMessageMock = vi.fn();

vi.mock("../lib/api", () => ({
  sendContactMessage: (...args) => sendContactMessageMock(...args),
}));

describe("ContactPage", () => {
  beforeEach(() => {
    sendContactMessageMock.mockReset();
    sendContactMessageMock.mockResolvedValue({
      message: "Message received. We will get back to you soon.",
    });
  });

  it("submits the contact form through the backend API", async () => {
    const showToast = vi.fn();
    render(<ContactPage showToast={showToast} />);

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Ayush" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "ayush@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Need a pilot demo." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendContactMessageMock).toHaveBeenCalledWith({
        name: "Ayush",
        email: "ayush@example.com",
        message: "Need a pilot demo.",
      });
    });

    expect(showToast).toHaveBeenCalledWith(
      "Message received. We will get back to you soon.",
      "success",
    );
    expect(
      screen.getByText("Message received. We will get back to you soon."),
    ).toBeInTheDocument();
  });
});
