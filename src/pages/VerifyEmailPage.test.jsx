import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VerifyEmailPage } from "./VerifyEmailPage";

const verifyEmailMock = vi.fn();

vi.mock("../lib/api", () => ({
  verifyEmail: (...args) => verifyEmailMock(...args),
}));

function renderPage(showToast) {
  return render(
    <MemoryRouter initialEntries={["/verify-email?token=test-token"]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailPage showToast={showToast} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    verifyEmailMock.mockReset();
    verifyEmailMock.mockResolvedValue({ message: "Email verified." });
  });

  it("verifies a token only once even when showToast changes", async () => {
    const firstToast = vi.fn();
    const secondToast = vi.fn();
    const view = renderPage(firstToast);

    await waitFor(() => {
      expect(verifyEmailMock).toHaveBeenCalledTimes(1);
    });

    view.rerender(
      <MemoryRouter initialEntries={["/verify-email?token=test-token"]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage showToast={secondToast} />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Email verified.")).toBeInTheDocument();
    });

    expect(verifyEmailMock).toHaveBeenCalledTimes(1);
  });
});
