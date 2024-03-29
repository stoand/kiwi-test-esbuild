// #SPC-kakoune_interface
import { execFileSync } from 'child_process';
import { writeFileSync, writeFile, mkdirSync, rmdirSync } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';


const deadKakInstancePostfix = '(dead)';

const maxNotificationLength = 30;
const inlineNormalTextColor = 'Default';
const inlineErrorTextColor = 'rgb:ffffff,rgb:ab4434';
const statusChars = '██';
const uncoveredColors = 'rgb:434343';
const failedColors = 'rgb:ab4434';
const successColors = 'rgb:a1b56b';

const notificationBufferName = '*kiwi-notification*';

export const tempDir = '/tmp/__kiwi_tmp435398/';

// When to update the highlighters
const refreshHighlighting = [
    // 'BufWritePre',
    // 'WinDisplay',
    // 'ModeChange',
    // 'InsertKey',
    // 'NormalKey',
    // 'RawKey',
];

export type LineStatus = 'uncovered' | 'fail' | 'success';
export type LineStatuses = { [line: number]: LineStatus };
export type FileStatuses = { [file: string]: LineStatuses };

export type LineLabel = { color: 'normal' | 'error', text: string };
export type LineLabels = { [line: number]: LineLabel };
export type FileLabels = { [file: string]: LineLabels };

export type Location = { file: string, line: number, message: string }

export type FullNotification = { file: string, line: number, json: string };

export function createTmpDir() {
    // rmdirSync(tempDir, { recursive: true });
    mkdirSync(tempDir, { recursive: true });
}

// #SPC-kakoune_interface.running_instances
export function running_instances() {
    let lines = execFileSync('kak', ['-l'], { encoding: 'utf8' }).split('\n');
    // remove the last empty line
    return lines.splice(0, lines.length - 1).filter(line => line.indexOf(deadKakInstancePostfix) == -1);
}

// #SPC-kakoune_interface.init_highlighters
export function init_highlighters() {

    createTmpDir();

    let commands = `
		eval %sh{ [ -z "$kak_opt_kiwi_line_statuses" ] &&
			echo "declare-option line-specs kiwi_line_statuses; addhl global/ flag-lines Default kiwi_line_statuses" }
			
		eval %sh{ [ -z "$kak_opt_kiwi_line_notifications" ] &&
			echo "declare-option line-specs kiwi_line_notifications; addhl global/ flag-lines Default kiwi_line_notifications" }
    `;

    command_all(commands);
}


// #SPC-kakoune_interface.send_command
export function send_command(instance: string, command: string) {
    let input = "eval -client client0 '" + command + "'";
    return execFileSync('kak', ['-p', instance], { encoding: 'utf8', input });
}

function command_all(command: string) {
    running_instances().forEach(instance => send_command(instance, command));
}

let line_statuses_previous_files: string[] = [];

// #SPC-kakoune_interface.line_statuses
export function line_statuses(file_statuses: FileStatuses) {

    let format_lines = (lines: LineStatuses) => Object.keys(lines).map(line => {
        let value = lines[Number(line)];
        let text = '%opt{kiwi_status_chars}';
        return `\\"${Number(line) + 1}|{%opt{kiwi_color_${value}}}${text}\\"`;
    }).join(' ');

    // Clear statuses from previous files that are no longer mentioned
    for (let previous_file of line_statuses_previous_files) {
        if (!file_statuses[previous_file]) {
            file_statuses[previous_file] = {};
        }
    }


    let set_highlighters = Object.keys(file_statuses).map(file => `eval %sh{
        echo "try %{ set-option buffer=""${file}"" kiwi_line_statuses %val{timestamp} ` + format_lines(file_statuses[file]) + '" } }').join('\n');


    let refresh_hooks = refreshHighlighting.map((name: string) =>
        `hook -group kiwi-line-statuses-group global ${name} .* kiwi_line_statuses`).join('\n');

    let commands = `
    	define-command -hidden -override kiwi_line_statuses %{
    		declare-option str kiwi_status_chars "${statusChars}"
   		
    		declare-option str kiwi_color_uncovered "${uncoveredColors}"
    		declare-option str kiwi_color_fail "${failedColors}"
    		declare-option str kiwi_color_success "${successColors}"
        	
    		${set_highlighters}
    	}
    	
    	remove-hooks global kiwi-line-statuses-group

		${refresh_hooks}
		
    	kiwi_line_statuses
    	
    	hook global BufOpenFile .* kiwi_line_statuses
    `;

    line_statuses_previous_files = Object.keys(file_statuses);

    command_all(commands);
}

function fix_size(text: string, length: number) {
    let chars = text.split('');
    if (chars.length > length) {
        chars = chars.splice(0, length - 3);
        return chars.join('') + ' ..';
    } else {
        while (chars.length < length) chars.push(' ');
        return chars.join('');
    }
}

let line_notificaitons_previous_files: string[] = [];

function escape_flag_lines(text: string) {
    return text
        // Escape by doubling
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '""')
        .replace(/'/g, "''")
        .replace(/\%/g, "%%")
        .replace(/\{/g, "\\{")
        // .replace(/\}/g, "\\}") 
        .replace(/\|/g, '\\||');
}

export function md5Hash(input: string) {
    return createHash('md5').update(input).digest('hex')
}

// #SPC-kakoune_interface.line_notifications
export function line_notifications(file_notifications: FileLabels) {

    // anti-bounce:
    // when only a single notification is present the notifications 
    // area will disappear when text on that line is edited
    //
    // having an invisible notfication on a negative line prevents this behavior
    Object.keys(file_notifications).map(file => {
        file_notifications[file]['-1'] = { text: ' ', color: 'normal' };
    });

    let format_lines = (lines: LineLabels) => Object.keys(lines).map(line => {
        let { color, text } = lines[Number(line)];
        let truncated_text = fix_size(text, maxNotificationLength);
        let escaped_text = escape_flag_lines(truncated_text);
        let color_opt = `kiwi_color_${color}_notification`;
        let num = Number(line);
        return `\\"${num}||{Default} {%opt{${color_opt}}}${escaped_text}\\"`;
    }).join(' ');

    let set_highlighters = Object.keys(file_notifications).map(file => `eval %sh{
        echo "try %| set-option buffer=""${file}"" kiwi_line_notifications %val{timestamp} ` + format_lines(file_notifications[file]) + '" } |').join('\n');

    let remove_highlighters = line_notificaitons_previous_files.filter(file => !file_notifications[file]).map(file =>
        `eval %sh{ try %{
            echo "set-option buffer=""${file}"" kiwi_line_notifications %val{timestamp} " } }`).join('\n');

    let refresh_hooks = refreshHighlighting.map((name: string) =>
        `hook -group kiwi-line-notifications-group global ${name} .* kiwi_line_notifications`).join('\n');

    let commands = `
		declare-option str kiwi_color_normal_notification "${inlineNormalTextColor}"
		declare-option str kiwi_color_error_notification "${inlineErrorTextColor}"

    	define-command -hidden -override kiwi_line_notifications %{
    	    ${set_highlighters}
    	
    		${remove_highlighters}
    	}

    	remove-hooks global kiwi-line-notifications-group

		${refresh_hooks}
        kiwi_line_notifications
    	hook global BufOpenFile .* kiwi_line_notifications
    `;

    line_notificaitons_previous_files = Object.keys(file_notifications);

    command_all(commands);
}

/// #SPC-kakoune_interface.add_location_list_command
export function add_location_list_command(name: string, locations: Location[], selectCurrentLine = false) {
    let contents = locations.map(({ file, line, message }) =>
        `${file}:${line}: ${message}`).join('\n');

    let selectLocationCommands = '';

    if (selectCurrentLine) {
        let locationLines: { [name: string]: { index: number, newLines: number }[] } = {};

        let locationAcc = 1;

        locations.forEach((location, locationIndex) => {
            let locationName = location.file + ':' + location.line;
            locationLines[locationName] = locationLines[locationName] || [];

            let newLines = location.message.split('\n').length;
            locationLines[locationName].push({ index: locationIndex + locationAcc, newLines });
            locationAcc += newLines - 1;
        });

        for (let locationName in locationLines) {
            let selections = locationLines[locationName].map(loc =>
                `${loc.index}.1,${loc.index + loc.newLines - 1}.999`).join(' ');

            selectLocationCommands += `
                eval %sh{
                    [ "$kak_opt_prev_buffile:$kak_opt_prev_cursor_line" = "${locationName}" ] && \
                        echo "select ${selections}"
                }            
            `;
        }
    }

    let location = path.join(tempDir, name);

    writeFileSync(location, contents);

    let nameWithDashes = name.replace(/_/g, '-');

    let commands = `
        define-command -override kiwi-list-${nameWithDashes} %{
          declare-option str prev_buffile %val{buffile} 
          declare-option str prev_cursor_line %val{cursor_line} 
          
          edit! -readonly -existing "${location}"
          set-option buffer filetype grep

          ${selectLocationCommands}
        }
    `;

    command_all(commands);
}

/// #SPC-kakoune_interface.jump_to_line
export function jump_to_line(file: string, line: number) {
    command_all(`edit! -existing "${file}" ${line}`);
}

/// #SPC-kakoune_interface.register_full_notifications
export function register_full_notifications(notifications: FullNotification[]) {

    let notificationCommands = notifications.map(notification => {

        let hash = md5Hash(notification.file + ':' + notification.line);
        let contentsPath = path.join(tempDir, './notification_' + hash + '.json');

        writeFile(contentsPath, notification.json.toString(), err =>
            err && console.error('register_full_notifications write failed: ', err));

        let hashWithDash = hash + '  -';

        return `
            eval %sh{
                sum=$(echo -n "$kak_buffile:$kak_cursor_line" | md5sum)
                [ "$sum" = "${hashWithDash}" ] && \
                    echo "try %{ delete-buffer! ${notificationBufferName} }; \
                        edit! -existing ${contentsPath}; \
                        rename-buffer -scratch ${notificationBufferName}; \
                        try %{ delete-buffer! ${contentsPath} }"
            }
        `;
    });

    let commands = `
        define-command -override kiwi-open-notification %{
            ${notificationCommands.join('\n')}
        }
    `;

    command_all(commands);
}
