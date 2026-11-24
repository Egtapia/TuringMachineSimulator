{
  "presets": [
    {
      "id": "binary-increment",
      "name": "Binary Increment  f(x) = x + 1",
      "description": "Adds 1 to a binary number (most significant bit first). Scans to the right end, then propagates the carry leftwards.",
      "max_steps": 1000,
      "default_input": "1011",
      "examples": [
        {"input": "1011", "expected": "accepted", "expected_tape": "1100"},
        {"input": "111", "expected": "accepted", "expected_tape": "1000"},
        {"input": "0", "expected": "accepted", "expected_tape": "1"},
        {"input": "1010", "expected": "accepted", "expected_tape": "1011"}
      ],
      "machine": {
        "states": ["q0", "q1", "q_accept", "q_reject"],
        "input_alphabet": ["0", "1"],
        "tape_alphabet": ["0", "1", "_"],
        "blank": "_",
        "start_state": "q0",
        "accept_state": "q_accept",
        "reject_state": "q_reject",
        "transitions": [
          {"from": "q0", "read": "0", "to": "q0", "write": "0", "move": "R"},
          {"from": "q0", "read": "1", "to": "q0", "write": "1", "move": "R"},
          {"from": "q0", "read": "_", "to": "q1", "write": "_", "move": "L"},
          {"from": "q1", "read": "1", "to": "q1", "write": "0", "move": "L"},
          {"from": "q1", "read": "0", "to": "q_accept", "write": "1", "move": "S"},
          {"from": "q1", "read": "_", "to": "q_accept", "write": "1", "move": "S"}
        ]
      }
    },
    {
      "id": "unary-multiplication",
      "name": "Integer Multiplication  1^a * 1^b = 1^(a*b)",
      "description": "Unary multiplication. Input 1^a*1^b. For every 1 in a, the machine copies b to the right of '='. Result: 1^a*1^b=1^(a*b).",
      "max_steps": 5000,
      "default_input": "11*111",
      "examples": [
        {"input": "11*111", "expected": "accepted", "expected_tape": "11*111=111111"},
        {"input": "111*11", "expected": "accepted", "expected_tape": "111*11=111111"},
        {"input": "1*1", "expected": "accepted", "expected_tape": "1*1=1"},
        {"input": "*11", "expected": "accepted", "expected_tape": "*11="},
        {"input": "11*", "expected": "accepted", "expected_tape": "11*="},
        {"input": "11", "expected": "no_transition"}
      ],
      "machine": {
        "states": ["q_seek_end", "q_rewind", "q_find_a", "q_go_b", "q_scan_b", "q_go_out", "q_back_out", "q_back_b", "q_restore_b", "q_back_a", "q_cleanup", "q_accept", "q_reject"],
        "input_alphabet": ["1", "*"],
        "tape_alphabet": ["1", "*", "=", "X", "Y", "_"],
        "blank": "_",
        "start_state": "q_seek_end",
        "accept_state": "q_accept",
        "reject_state": "q_reject",
        "transitions": [
          {"from": "q_seek_end", "read": "1", "to": "q_seek_end", "write": "1", "move": "R"},
          {"from": "q_seek_end", "read": "*", "to": "q_seek_end", "write": "*", "move": "R"},
          {"from": "q_seek_end", "read": "_", "to": "q_rewind", "write": "=", "move": "L"},
          {"from": "q_rewind", "read": "1", "to": "q_rewind", "write": "1", "move": "L"},
          {"from": "q_rewind", "read": "*", "to": "q_rewind", "write": "*", "move": "L"},
          {"from": "q_rewind", "read": "=", "to": "q_rewind", "write": "=", "move": "L"},
          {"from": "q_rewind", "read": "_", "to": "q_find_a", "write": "_", "move": "R"},
          {"from": "q_find_a", "read": "X", "to": "q_find_a", "write": "X", "move": "R"},
          {"from": "q_find_a", "read": "1", "to": "q_go_b", "write": "X", "move": "R"},
          {"from": "q_find_a", "read": "*", "to": "q_cleanup", "write": "*", "move": "L"},
          {"from": "q_go_b", "read": "1", "to": "q_go_b", "write": "1", "move": "R"},
          {"from": "q_go_b", "read": "X", "to": "q_go_b", "write": "X", "move": "R"},
          {"from": "q_go_b", "read": "*", "to": "q_scan_b", "write": "*", "move": "R"},
          {"from": "q_scan_b", "read": "Y", "to": "q_scan_b", "write": "Y", "move": "R"},
          {"from": "q_scan_b", "read": "1", "to": "q_go_out", "write": "Y", "move": "R"},
          {"from": "q_scan_b", "read": "=", "to": "q_restore_b", "write": "=", "move": "L"},
          {"from": "q_go_out", "read": "1", "to": "q_go_out", "write": "1", "move": "R"},
          {"from": "q_go_out", "read": "Y", "to": "q_go_out", "write": "Y", "move": "R"},
          {"from": "q_go_out", "read": "=", "to": "q_go_out", "write": "=", "move": "R"},
          {"from": "q_go_out", "read": "_", "to": "q_back_out", "write": "1", "move": "L"},
          {"from": "q_back_out", "read": "1", "to": "q_back_out", "write": "1", "move": "L"},
          {"from": "q_back_out", "read": "=", "to": "q_back_b", "write": "=", "move": "L"},
          {"from": "q_back_b", "read": "1", "to": "q_back_b", "write": "1", "move": "L"},
          {"from": "q_back_b", "read": "Y", "to": "q_back_b", "write": "Y", "move": "L"},
          {"from": "q_back_b", "read": "*", "to": "q_scan_b", "write": "*", "move": "R"},
          {"from": "q_restore_b", "read": "Y", "to": "q_restore_b", "write": "1", "move": "L"},
          {"from": "q_restore_b", "read": "*", "to": "q_back_a", "write": "*", "move": "L"},
          {"from": "q_back_a", "read": "1", "to": "q_back_a", "write": "1", "move": "L"},
          {"from": "q_back_a", "read": "X", "to": "q_back_a", "write": "X", "move": "L"},
          {"from": "q_back_a", "read": "_", "to": "q_find_a", "write": "_", "move": "R"},
          {"from": "q_cleanup", "read": "X", "to": "q_cleanup", "write": "1", "move": "L"},
          {"from": "q_cleanup", "read": "_", "to": "q_accept", "write": "_", "move": "R"}
        ]
      }
    },
    {
      "id": "w-hash-w",
      "name": "Language  L = { w#w | w in {0,1}* }",
      "description": "Decider for w#w. Marks the first unmarked symbol left of '#' with X, finds its twin on the right and marks it with Y, repeats. Accepts iff both halves match exactly.",
      "max_steps": 5000,
      "default_input": "0110#0110",
      "examples": [
        {"input": "0110#0110", "expected": "accepted"},
        {"input": "01#01", "expected": "accepted"},
        {"input": "#", "expected": "accepted"},
        {"input": "01#10", "expected": "rejected"},
        {"input": "01#011", "expected": "rejected"},
        {"input": "011#01", "expected": "rejected"},
        {"input": "", "expected": "rejected"},
        {"input": "0101", "expected": "no_transition"}
      ],
      "machine": {
        "states": ["q0", "q_zero", "q_one", "q_zero_b", "q_one_b", "q_back", "q_check", "q_accept", "q_reject"],
        "input_alphabet": ["0", "1", "#"],
        "tape_alphabet": ["0", "1", "#", "X", "Y", "_"],
        "blank": "_",
        "start_state": "q0",
        "accept_state": "q_accept",
        "reject_state": "q_reject",
        "transitions": [
          {"from": "q0", "read": "0", "to": "q_zero", "write": "X", "move": "R"},
          {"from": "q0", "read": "1", "to": "q_one", "write": "X", "move": "R"},
          {"from": "q0", "read": "X", "to": "q0", "write": "X", "move": "R"},
          {"from": "q0", "read": "#", "to": "q_check", "write": "#", "move": "R"},
          {"from": "q0", "read": "_", "to": "q_reject", "write": "_", "move": "S"},
          {"from": "q_zero", "read": "0", "to": "q_zero", "write": "0", "move": "R"},
          {"from": "q_zero", "read": "1", "to": "q_zero", "write": "1", "move": "R"},
          {"from": "q_zero", "read": "#", "to": "q_zero_b", "write": "#", "move": "R"},
          {"from": "q_one", "read": "0", "to": "q_one", "write": "0", "move": "R"},
          {"from": "q_one", "read": "1", "to": "q_one", "write": "1", "move": "R"},
          {"from": "q_one", "read": "#", "to": "q_one_b", "write": "#", "move": "R"},
          {"from": "q_zero_b", "read": "Y", "to": "q_zero_b", "write": "Y", "move": "R"},
          {"from": "q_zero_b", "read": "0", "to": "q_back", "write": "Y", "move": "L"},
          {"from": "q_zero_b", "read": "1", "to": "q_reject", "write": "1", "move": "S"},
          {"from": "q_zero_b", "read": "_", "to": "q_reject", "write": "_", "move": "S"},
          {"from": "q_one_b", "read": "Y", "to": "q_one_b", "write": "Y", "move": "R"},
          {"from": "q_one_b", "read": "1", "to": "q_back", "write": "Y", "move": "L"},
          {"from": "q_one_b", "read": "0", "to": "q_reject", "write": "0", "move": "S"},
          {"from": "q_one_b", "read": "_", "to": "q_reject", "write": "_", "move": "S"},
          {"from": "q_back", "read": "0", "to": "q_back", "write": "0", "move": "L"},
          {"from": "q_back", "read": "1", "to": "q_back", "write": "1", "move": "L"},
          {"from": "q_back", "read": "#", "to": "q_back", "write": "#", "move": "L"},
          {"from": "q_back", "read": "X", "to": "q_back", "write": "X", "move": "L"},
          {"from": "q_back", "read": "Y", "to": "q_back", "write": "Y", "move": "L"},
          {"from": "q_back", "read": "_", "to": "q0", "write": "_", "move": "R"},
          {"from": "q_check", "read": "Y", "to": "q_check", "write": "Y", "move": "R"},
          {"from": "q_check", "read": "_", "to": "q_accept", "write": "_", "move": "S"},
          {"from": "q_check", "read": "0", "to": "q_reject", "write": "0", "move": "S"},
          {"from": "q_check", "read": "1", "to": "q_reject", "write": "1", "move": "S"}
        ]
      }
    },
    {
      "id": "busy-beaver-3",
      "name": "Busy Beaver (3 states, 2 symbols)",
      "description": "The 3-state champion: starting on a blank tape it writes six 1s and halts after 13 steps. Halting is mapped to q_accept.",
      "max_steps": 100,
      "default_input": "",
      "examples": [
        {"input": "", "expected": "accepted", "expected_tape": "111111", "expected_steps": 13}
      ],
      "machine": {
        "states": ["A", "B", "C", "q_accept", "q_reject"],
        "input_alphabet": ["1"],
        "tape_alphabet": ["1", "_"],
        "blank": "_",
        "start_state": "A",
        "accept_state": "q_accept",
        "reject_state": "q_reject",
        "transitions": [
          {"from": "A", "read": "_", "to": "B", "write": "1", "move": "R"},
          {"from": "A", "read": "1", "to": "C", "write": "1", "move": "L"},
          {"from": "B", "read": "_", "to": "A", "write": "1", "move": "L"},
          {"from": "B", "read": "1", "to": "B", "write": "1", "move": "R"},
          {"from": "C", "read": "_", "to": "B", "write": "1", "move": "L"},
          {"from": "C", "read": "1", "to": "q_accept", "write": "1", "move": "R"}
        ]
      }
    },
    {
      "id": "busy-beaver-4",
      "name": "Busy Beaver (4 states, 2 symbols)  [bonus]",
      "description": "The 4-state champion: thirteen 1s in 107 steps. A great stress test for tape expansion in both directions.",
      "max_steps": 200,
      "default_input": "",
      "examples": [
        {"input": "", "expected": "accepted", "expected_steps": 107}
      ],
      "machine": {
        "states": ["A", "B", "C", "D", "q_accept", "q_reject"],
        "input_alphabet": ["1"],
        "tape_alphabet": ["1", "_"],
        "blank": "_",
        "start_state": "A",
        "accept_state": "q_accept",
        "reject_state": "q_reject",
        "transitions": [
          {"from": "A", "read": "_", "to": "B", "write": "1", "move": "R"},
          {"from": "A", "read": "1", "to": "B", "write": "1", "move": "L"},
          {"from": "B", "read": "_", "to": "A", "write": "1", "move": "L"},
          {"from": "B", "read": "1", "to": "C", "write": "_", "move": "L"},
          {"from": "C", "read": "_", "to": "q_accept", "write": "1", "move": "R"},
          {"from": "C", "read": "1", "to": "D", "write": "1", "move": "L"},
          {"from": "D", "read": "_", "to": "D", "write": "1", "move": "R"},
          {"from": "D", "read": "1", "to": "A", "write": "_", "move": "R"}
        ]
      }
    }
  ]
}
