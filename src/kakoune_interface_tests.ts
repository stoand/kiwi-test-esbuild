// Tests for functions that control interaction with the Kakoune editor
// Since it's difficult to programatically check the state of the Kakoune
// editor THESE TESTS REQUIRE MANUAL INTERACTION

// Another purpose of these tests is to have a place to run this functionality
// in isolation while in development.

import { init_highlighters, line_statuses, createTmpDir,
	line_notifications, add_location_list_command, jump_to_line,
	register_full_notifications } from './kakoune_interface';
import path from 'path';

// Test the editor interactions while editing this file
let currentFile = path.resolve(process.cwd(), 'src/kakoune_interface_tests.ts');

let empty: any = {};
for (let i = 0; i < 200; i++) {
    empty[i] = 'uncovered';
}

// #SPC-kakoune_interface.tst-line_statuses
function test_line_statuses() {
    line_statuses({
        [currentFile]: {
            // ...empty,
            10: 'uncovered',
            11: 'fail',

            12: 'success',
        }
    });
}

// #SPC-kakoune_interface.tst-line_notifications
function test_line_notifications() {
    line_notifications({
        [currentFile]: {
            38: { text: '1, 2, 3', color: 'error' },
            39: { text: 'this text goes here', color: 'normal' },
            40: { text: 'this text is too long because it should be truncated', color: 'normal' },
            // #SPC-kakoune_interface.tst-line_notifications_escaping
            42: { text: `handle1 g|| \\ a "' % { correctly`, color: 'normal' },
            
        }
    });
}

/// #SPC-kakoune_interface.tst-add_location_list_command
function test_add_location_list_command() {
    let data = [
        { file: 'src/kakoune_interface_tests.ts', line: 50, message: 'asdf' },
        { file: 'src/kakoune_interface_tests.ts', line: 90, message: 'more', sel: true },
    ];
    add_location_list_command('one', data);
}
/// #SPC-kakoune_interface.tst-jump_to_line
function test_jump_to_line() {
	jump_to_line('src/kakoune_interface_tests.ts', 60);
}



/// #SPC-kakoune_interface.tst-register_full_notifications
function test_register_full_notifications() {
    // how to run this test:
    // go to line 70 of this file
    // and in kakoune run `kiwi-open-notification`
    
    let notifications = [
        { file: currentFile, line: 70, json: '{a:1}'},
    ];
    
    register_full_notifications(notifications);
}

init_highlighters();

// The notifications should be displayed to the left of statuses
test_line_notifications();

test_line_statuses();

createTmpDir();

test_add_location_list_command();

// Disabled - this test is disruptive
// test_jump_to_line();

test_register_full_notifications();
