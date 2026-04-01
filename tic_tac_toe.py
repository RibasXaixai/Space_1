import tkinter as tk
from tkinter import messagebox


class TicTacToeApp:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Tic Tac Toe")
        self.root.configure(bg="#f3f6fb")
        self.root.resizable(False, False)

        self.current_player = "X"
        self.board = [""] * 9
        self.game_over = False
        self.game_mode = tk.StringVar(value="PvP")
        self.scores = {"X": 0, "O": 0, "Draw": 0}

        self.buttons = []
        self.score_labels = {}

        self.create_widgets()
        self.update_status_label()

    def create_widgets(self):
        header = tk.Label(
            self.root,
            text="Tic Tac Toe",
            font=("Segoe UI", 20, "bold"),
            bg="#f3f6fb",
            fg="#2c3e50",
        )
        header.pack(pady=(16, 10))

        mode_frame = tk.Frame(self.root, bg="#f3f6fb")
        mode_frame.pack(pady=(0, 12), padx=16, fill="x")

        mode_label = tk.Label(
            mode_frame,
            text="Game Mode:",
            bg="#f3f6fb",
            fg="#2c3e50",
            font=("Segoe UI", 10, "bold"),
        )
        mode_label.grid(row=0, column=0, sticky="w")

        pvp_radio = tk.Radiobutton(
            mode_frame,
            text="Player vs Player",
            variable=self.game_mode,
            value="PvP",
            command=self.on_mode_changed,
            bg="#f3f6fb",
            fg="#2c3e50",
            selectcolor="#e8f0ff",
            font=("Segoe UI", 10),
            activebackground="#f3f6fb",
        )
        pvp_radio.grid(row=1, column=0, sticky="w", pady=4)

        pvc_radio = tk.Radiobutton(
            mode_frame,
            text="Player vs Computer",
            variable=self.game_mode,
            value="PvC",
            command=self.on_mode_changed,
            bg="#f3f6fb",
            fg="#2c3e50",
            selectcolor="#e8f0ff",
            font=("Segoe UI", 10),
            activebackground="#f3f6fb",
        )
        pvc_radio.grid(row=2, column=0, sticky="w")

        scoreboard_frame = tk.Frame(self.root, bg="#ffffff", bd=1, relief="solid")
        scoreboard_frame.pack(padx=16, pady=(0, 16), fill="x")

        self.score_labels["X"] = self.create_score_cell(scoreboard_frame, "X Wins", 0)
        self.score_labels["O"] = self.create_score_cell(scoreboard_frame, "O Wins", 1)
        self.score_labels["Draw"] = self.create_score_cell(scoreboard_frame, "Draws", 2)

        board_frame = tk.Frame(self.root, bg="#f3f6fb")
        board_frame.pack(padx=16, pady=(0, 14))

        for index in range(9):
            button = tk.Button(
                board_frame,
                text="",
                width=4,
                height=2,
                font=("Segoe UI", 24, "bold"),
                bg="#ffffff",
                fg="#2c3e50",
                activebackground="#dfe7ff",
                activeforeground="#2c3e50",
                bd=2,
                relief="raised",
                command=lambda index=index: self.on_cell_clicked(index),
            )
            row = index // 3
            column = index % 3
            button.grid(row=row, column=column, padx=6, pady=6)
            self.buttons.append(button)

        self.status_label = tk.Label(
            self.root,
            text="",
            font=("Segoe UI", 12),
            bg="#f3f6fb",
            fg="#34495e",
        )
        self.status_label.pack(pady=(0, 16))

        control_frame = tk.Frame(self.root, bg="#f3f6fb")
        control_frame.pack(padx=16, pady=(0, 16), fill="x")

        restart_button = tk.Button(
            control_frame,
            text="Restart Round",
            command=self.restart_round,
            bg="#5a9bfd",
            fg="#ffffff",
            font=("Segoe UI", 10, "bold"),
            activebackground="#4a8feb",
            activeforeground="#ffffff",
            bd=0,
            relief="ridge",
            padx=10,
            pady=8,
        )
        restart_button.pack(side="left", expand=True, fill="x", padx=(0, 8))

        reset_button = tk.Button(
            control_frame,
            text="Reset Score",
            command=self.reset_score,
            bg="#ff6b6b",
            fg="#ffffff",
            font=("Segoe UI", 10, "bold"),
            activebackground="#e75a5a",
            activeforeground="#ffffff",
            bd=0,
            relief="ridge",
            padx=10,
            pady=8,
        )
        reset_button.pack(side="left", expand=True, fill="x", padx=(8, 0))

    def create_score_cell(self, parent, title, column_index):
        frame = tk.Frame(parent, bg="#ffffff")
        frame.grid(row=0, column=column_index, padx=10, pady=12)

        title_label = tk.Label(
            frame,
            text=title,
            bg="#ffffff",
            fg="#6c7a89",
            font=("Segoe UI", 10),
        )
        title_label.pack()

        score_label = tk.Label(
            frame,
            text="0",
            bg="#ffffff",
            fg="#2c3e50",
            font=("Segoe UI", 18, "bold"),
        )
        score_label.pack()
        return score_label

    def on_mode_changed(self):
        self.restart_round()

    def on_cell_clicked(self, index):
        if self.game_over:
            return
        if self.board[index] != "":
            return

        self.make_move(index)

        if self.game_mode.get() == "PvC" and not self.game_over:
            self.root.after(180, self.computer_move)

    def make_move(self, index):
        self.board[index] = self.current_player
        self.update_button(index)

        winner, winning_indices = self.check_winner()
        if winner:
            self.end_game(winner, winning_indices)
            return

        if self.check_draw():
            self.end_game(None, None)
            return

        self.current_player = "O" if self.current_player == "X" else "X"
        self.update_status_label()

    def update_button(self, index):
        button = self.buttons[index]
        button.config(text=self.current_player, state="disabled")

    def check_winner(self):
        lines = [
            (0, 1, 2),
            (3, 4, 5),
            (6, 7, 8),
            (0, 3, 6),
            (1, 4, 7),
            (2, 5, 8),
            (0, 4, 8),
            (2, 4, 6),
        ]
        for a, b, c in lines:
            if self.board[a] == self.board[b] == self.board[c] != "":
                return self.board[a], (a, b, c)
        return None, None

    def check_draw(self):
        return all(cell != "" for cell in self.board)

    def highlight_winning_cells(self, indices):
        if not indices:
            return
        for index in indices:
            self.buttons[index].config(bg="#a8e6cf", fg="#1d3557")

    def computer_move(self):
        if self.game_over or self.current_player != "O":
            return

        best_index = self.get_best_move()
        if best_index is not None:
            self.make_move(best_index)

    def get_best_move(self):
        empty_cells = [index for index, value in enumerate(self.board) if value == ""]

        # Try to win first
        for index in empty_cells:
            self.board[index] = "O"
            winner, _ = self.check_winner()
            self.board[index] = ""
            if winner == "O":
                return index

        # Block opponent win
        for index in empty_cells:
            self.board[index] = "X"
            winner, _ = self.check_winner()
            self.board[index] = ""
            if winner == "X":
                return index

        # Prefer center, then corners, then edges
        priority = [4, 0, 2, 6, 8, 1, 3, 5, 7]
        for index in priority:
            if self.board[index] == "":
                return index
        return None

    def restart_round(self):
        self.board = [""] * 9
        self.game_over = False
        self.current_player = "X"
        for button in self.buttons:
            button.config(text="", state="normal", bg="#ffffff", fg="#2c3e50")
        self.update_status_label()

    def reset_score(self):
        self.scores = {"X": 0, "O": 0, "Draw": 0}
        self.update_scoreboard()
        self.restart_round()

    def update_scoreboard(self):
        self.score_labels["X"].config(text=str(self.scores["X"]))
        self.score_labels["O"].config(text=str(self.scores["O"]))
        self.score_labels["Draw"].config(text=str(self.scores["Draw"]))

    def update_status_label(self):
        if self.game_over:
            return
        if self.game_mode.get() == "PvP":
            self.status_label.config(text=f"Current turn: {self.current_player}")
        else:
            self.status_label.config(text=f"Current turn: {self.current_player} (You are X)")

    def end_game(self, winner, winning_indices):
        self.game_over = True
        for button in self.buttons:
            button.config(state="disabled")

        if winner:
            self.highlight_winning_cells(winning_indices)
            self.scores[winner] += 1
            self.update_scoreboard()
            message = f"Player {winner} wins!"
            self.status_label.config(text=message)
            messagebox.showinfo("Game Over", message)
        else:
            self.scores["Draw"] += 1
            self.update_scoreboard()
            self.status_label.config(text="It's a draw!")
            messagebox.showinfo("Game Over", "It's a draw!")

    def run(self):
        self.root.mainloop()


if __name__ == "__main__":
    TicTacToeApp().run()
