# TODOs

0. [DONE] Every individual `_I` annotation should use a file index instead of the full file path to save space
1. [DONE] The js_printer should accumulate a list of all instrumented ranges and save these at the end.
    This will enable the inference of what block/expr were not called
2. [DONE] Copy over the test runtime
3. [DONE] Calculation of what lines were affected by failing or succeeding tests
4. [TODO] Test listing
    * tests
    * failing tests
    * test files
    * non-test files
5. [DONE] Console.log
6. [TODO] Open console, error output as seperate files
    Also use a diff library and syntax highlighting
7. [TODO] Multicore execution
8. [TODO] partial line coverage
