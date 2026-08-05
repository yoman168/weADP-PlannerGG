export const en: Record<string, string> = {
  // ── Global shell ──
  'app.name': 'WE-ADK',
  'app.subtitle': 'Design system',
  'nav.projects': 'Projects',
  'nav.notifications': 'Notifications',
  'nav.members': 'Members',
  'nav.archive': 'Archive',
  'nav.saveGitlab': 'Save to GitLab →',
  'nav.spend': 'Spend',
  'nav.spendOf': '${spend} / ${budget}',
  'nav.overBudget': 'Over budget: ${spend} spent of ${budget}',
  'nav.spentOf': '${spend} spent of ${budget}',
  'nav.mockupOnly': 'UI mockup only — no live data',

  // ── Tools / sidebar ──
  'tool.business': 'Business',
  'tool.design': 'Design',
  'tool.developer': 'Developer',
  'tool.qa': 'QA',

  // ── Sketcher tabs ──
  'tab.main': 'Main',
  'tab.task': 'Task',
  'tab.user': 'Draft',

  // ── Explorer ──
  'explorer.title': 'Explorer',
  'explorer.newFile': 'New canvas file',
  'explorer.newVersion': 'Start the next version',
  'explorer.collapse': 'Collapse folders',
  'explorer.collapseAll': 'Collapse all folders',
  'explorer.noVersions': 'No versions yet.',
  'explorer.designCount': '{count} design(s) across {versions} version(s)',
  'explorer.noDesigns': 'no designs',
  'explorer.added': 'Added in this round',
  'explorer.modified': 'Changed in this round',
  'explorer.modifiedCanvas': 'Canvas changed in this round',
  'explorer.modifiedLayout': 'Screen layout changed in this round',
  'explorer.modifiedBoth': 'Canvas and layout changed in this round',
  'explorer.unchanged': 'Carried over from the previous round, unchanged',
  'explorer.empty': 'empty',
  'explorer.addFile': 'add a file',
  'explorer.carryOver': 'carry the released designs over',
  'explorer.baselineInfo':
    'version 1 is the baseline — the html prototype where the product is live, the meeting designs where it is not. Each round of change gets the next version.',

  // ── Version status ──
  'status.released': 'Released',
  'status.inProgress': 'In progress',
  'status.markAs': '{name} is {status} — mark it {next}',
  'status.versionStatus': 'version {version} is {status}.',

  // ── New design dialog ──
  'newDesign.title': 'New design file',
  'newDesign.name': 'Design name',
  'newDesign.namePlaceholder': 'Repayment simulation',
  'newDesign.version': 'Version',
  'newDesign.route': 'Route (optional)',
  'newDesign.routePlaceholder': '/loan/apply/simulation',
  'newDesign.layout': 'Starting layout',
  'newDesign.create': 'Create and open in the canvas',
  'newDesign.listScreen': 'List screen',
  'newDesign.detailScreen': 'Detail / form screen',
  'newDesign.dashboard': 'Dashboard',

  // ── New folder dialog ──
  'newFolder.title': 'New folder in {name}',
  'newFolder.label': 'Folder name',
  'newFolder.placeholder': 'approval flow',
  'newFolder.hint': 'Design files can be created inside it, and it travels with the round.',
  'newFolder.create': 'Create folder',

  // ── Remove dialogs ──
  'remove.folderTitle': 'Remove {name}?',
  'remove.folderDesc':
    '{count} design file(s) in this folder will be deleted with it. The rest of the round is untouched.',
  'remove.versionTitle': 'Remove {name}?',
  'remove.versionDesc':
    '{count} design file(s) in this round will be deleted with it. The baseline and the other versions are untouched.',
  'remove.cancel': 'Cancel',
  'remove.confirm': 'Remove {name}',

  // ── Flash messages ──
  'flash.saved': '{name} saved — markers cleared.',
  'flash.deleted': 'Deleted {name}.',
  'flash.moved': 'Moved {name} to {folder}.',
  'flash.removed': 'Removed {name}.',
  'flash.cloned': 'version {version} started from version {from} — {count} design(s) carried over.',
  'flash.clonedFolders':
    'version {version} started from version {from} — {count} design(s) in {folders} folder(s) carried over.',
  'flash.upToDate': '{name} is already up to date with version {version}.',
  'flash.carriedOver': '{count} design(s) carried over from version {from}.',
  'flash.carriedOverFolders':
    '{count} design(s) and {folders} folder(s) carried over from version {from}.',
  'flash.folderCreated': 'Folder {name} created in {parent}.',
  'flash.stillInProgress': 'version {version} is still in progress — release it first.',
  'flash.roundReleased': '{name} has been released — reopen it to make changes.',

  // ── File actions ──
  'file.edit': 'Edit {name}',
  'file.save': 'Save',
  'file.saveRound': 'Mark {name} as saved — clears the A and M markers',
  'file.editCanvas': 'Edit {name} on its canvas',
  'file.preview': 'Preview {name}',
  'file.previewBrowser': 'Preview {name} in a new browser tab',
  'file.delete': 'Delete {name}',
  'file.readOnly': 'Read-only baseline',
  'file.releasedReadOnly': '(released — read-only)',
  'file.liveScreen': 'previews the live screen',

  // ── Preview / Edit ──
  'view.preview': 'Preview',
  'view.edit': 'Edit',
  'view.openBrowser': 'Open in browser',

  // ── Badges ──
  'badge.html': 'html',
  'badge.liveScreen': 'live screen',
  'badge.wireframe': 'wireframe',
  'badge.localCli': 'local CLI',

  // ── Claude Code chat ──
  'chat.claudeCode': 'Claude Code',
  'chat.askAbout': 'Ask about {name}',
  'chat.greetingHint':
    'The screen you are previewing is in context — its layout and the file it belongs to.',
  'chat.pickFile': 'Pick a design file in the explorer to preview it.',

  // ── Floating action bar ──
  'action.improveAi': 'Improve by AI',
  'action.createTask': 'Create task',

  // ── Preview page ──
  'preview.prototypeHint': '{summary} · Edit UI changes this screen; Edit opens its canvas.',
  'preview.releasedHint':
    'This round has been released, so it is read-only — mark it In progress to change anything in it.',
  'preview.liveHint':
    'This file stands for a screen that is already live — the preview mounts the real page, so filters and search behave as they do in the product.',
  'preview.wireframeHint':
    'No live screen behind this file yet, so the preview shows the blocks drawn on its canvas.',
  'preview.notInVersion': '· Not in this version —',

  // ── User tab ──
  'user.team': 'Team',
  'user.addMember': 'Add member',
  'user.editMember': 'Edit member',
  'user.selectMember': 'Select a team member.',
  'user.selectMemberHint':
    'Browse their design workspace — each member has their own independent copy of the version files.',
  'user.selectFile': 'Select a design file.',
  'user.selectFileHint':
    "Pick a file from {name}'s tree to see its details or open it in the canvas.",
  'user.noMembers': 'No team members yet.',
  'user.memberRemoved': 'Member removed.',
  'user.memberAdded': '{name} added.',
  'user.memberUpdated': '{name} updated.',
  'user.files': '{count} files',
  'user.projectNotFound': 'That project does not exist.',
  'user.loadingTeam': 'Loading team…',
  'user.designCount': '{count} design(s) across {versions} version(s)',

  // ── Member form ──
  'member.name': 'Name',
  'member.namePlaceholder': 'Full name',
  'member.role': 'Role',
  'member.email': 'Email',
  'member.emailPlaceholder': 'name@company.com',
  'member.department': 'Department',
  'member.departmentPlaceholder': 'Engineering, Design, Product…',
  'member.save': 'Save changes',
  'member.add': 'Add member',
  'member.edit': 'Edit',
  'member.remove': 'Remove',

  // ── Roles ──
  'role.projectLead': 'Project Lead',
  'role.developer': 'Developer',
  'role.designer': 'Designer',
  'role.qa': 'QA',
  'role.pm': 'PM',
  'role.other': 'Other',

  // ── Canvas editor ──
  'canvas.empty': 'This canvas is empty',
  'canvas.emptyHint': 'Drag a block in from the left, or click one to append it.',
  'canvas.startList': 'Start from the List page pattern',
  'canvas.helpText':
    'Click a block to select · drag the handle to reorder · ⌘Z undo · ⌘D duplicate · ⌫ delete · ⌥↑/↓ move',
  'canvas.loading': 'Loading canvas…',

  // ── Chat ──
  'chat.placeholder': 'Write a message...',
  'chat.attachFiles': 'Attach files',
  'chat.attachFilesHint': 'Attach files — images are read by the model, text goes into the prompt',
  'chat.maxAttachments': 'Up to {max} files per message',
  'chat.model': 'Model',
  'chat.dictateStart': 'Dictate your message',
  'chat.dictateStop': 'Stop dictating',
  'chat.dictateUnavailable': 'Dictation is not available in this browser',
  'chat.stopReply': 'Stop the reply',
  'chat.send': 'Send',
  'chat.readAloud': 'Read the last reply aloud',
  'chat.stopReading': 'Stop reading',
  'chat.readUnavailable': 'Read-aloud is not available in this browser',
  'chat.nothingToRead': 'Nothing to read yet',
  'chat.disclaimer': 'Claude is AI and can make mistakes. Please double-check cited sources.',

  // ── Live preview ──
  'live.editMode': 'Edit mode',
  'live.done': 'Done',
  'live.editUi': 'Edit UI',
  'live.noLiveScreen': 'This design has no live screen behind it yet.',
  'live.resetEdits': "Throw away this file's edits",

  // ── Mockup board ──
  'board.variant': 'variant',
  'board.blocks': 'blocks',
  'board.loading': 'Loading…',
  'board.emptyScreen': 'Empty screen',
  'board.openCanvas': 'Open in canvas',
  'board.fromProduction': 'from production · ',
  'board.variantOf': 'variant of ',
  'board.noScreens': 'No screens yet.',
  'board.footnote': 'Every frame is a live canvas — click one to edit it, and edits show up here.',

  // ── Task form ──
  'task.editTask': 'Edit task',
  'task.newTask': 'New task',
  'task.title': 'Title',
  'task.titlePlaceholder': 'Fix the page-break issue…',
  'task.status': 'Status',
  'task.priority': 'Priority',
  'task.category': 'Category',
  'task.categoryPlaceholder': 'What is this task about?',
  'task.assignee': 'Assignee',
  'task.assigneePlaceholder': 'Name',
  'task.description': 'Description',
  'task.descriptionPlaceholder': 'Longer context…',
  'task.tags': 'Tags (comma-separated)',
  'task.tagsPlaceholder': 'bug, billing',
  'task.saveChanges': 'Save changes',
  'task.create': 'Create task',

  // ── Task comments ──
  'comments.like': 'Like',
  'comments.deleteComment': 'Delete this comment',
  'comments.pin': 'Pin to the top of the thread',
  'comments.unpin': 'Unpin',
  'comments.all': 'All',
  'comments.comment': 'Comment',
  'comments.noComments': 'No comments yet — say something below.',
  'comments.noActivity': 'Nothing has happened on this task yet.',
  'comments.writeComment': 'Write a comment on this task',
  'comments.placeholder': 'Enter to post, Shift+Enter for a new line',
  'comments.attachHint': 'Attach files — the comment records their names',
  'comments.maxAttachments': 'Up to {max} files per comment',
  'comments.post': 'Post the comment',

  // ── Task generate ──
  'generate.title': 'Generate the screens for this task',
  'generate.charsDesc': 'chars of description',
  'generate.noDesc': 'no description',
  'generate.file': 'file',
  'generate.files': 'files',
  'generate.textFrom': 'text from ',
  'generate.screensToPropose': 'Screens to propose',
  'generate.readAttached': 'Read the attached files',
  'generate.longFilesTrimmed': '· long files are trimmed',
  'generate.done': 'Done.',
  'generate.samplesHint':
    "Samples, kept on this task. Pick where they should go, then move the ones you want into the Main tab's explorer.",
  'generate.proposedScreen': 'proposed screen',
  'generate.screens': 'screens',
  'generate.editDesign': 'Edit design',
  'generate.preview': 'Preview',
  'generate.openHtml': 'Open html',
  'generate.drawing': 'Claude Code is drawing the screens… ',
  'generate.drawingHint':
    'Runs the local Claude Code CLI — nothing leaves this machine except the prompt.',
  'generate.generating': 'Generating',

  // ── Project home ──
  'home.title': 'Your projects',
  'home.subtitle':
    'Turn a customer conversation into a versioned project brief, screens and a clickable prototype — every design file kept in the project it belongs to.',
  'home.newProject': 'New project',
  'home.newProjectHint':
    'Creating a project is not part of this mockup — open one of the samples below.',
  'home.search': 'Search projects',
  'home.noArchived': 'Nothing archived yet.',
  'home.noMatch': 'No projects match that search.',

  // ── Project chrome ──
  'project.savedGitlab': 'Saved to GitLab',
  'project.committed': 'committed to GitLab',
  'project.notCommitted': 'not committed yet',

  // ── Reference files ──
  'files.referenceFiles': 'Reference files',
  'files.attach': 'Attach',
  'files.attachRef': 'Attach reference files to this meeting',
  'files.noAttached':
    "Nothing attached yet — add the customer's spreadsheet, a photo of the whiteboard or the call recording.",
  'files.closePreview': 'Close preview',
  'files.noPreview': 'No preview available for this file type.',
  'files.new': 'new',
  'files.preview': 'Preview',
  'files.removeFile': 'Remove this reference',
  'files.moreFiles': '+{count} more',

  // ── Misc ──
  'misc.nothingInFolder': 'Nothing in {name} yet.',
  'misc.nothingAttached': 'Nothing attached to this meeting.',
  'misc.copyCode': 'Copy code',
  'misc.dragToReorder': 'Drag to reorder layer',
  'misc.clickToSelect': 'Click to select · double-click to rename',
  'misc.showBlock': 'Show block',
  'misc.hideBlock': 'Hide block',
  'misc.deleteBlock': 'Delete block',
  'misc.duplicateBlock': 'Duplicate block',
  'misc.moveUp': 'Move up',
  'misc.moveDown': 'Move down',
  'misc.remove': 'Remove',
  'misc.toggleVisibility': 'Toggle visibility',
  'misc.notMockup': 'Not part of this mockup',

  // ── Canvas toolbar ──
  'canvas.undo': 'Undo · ⌘Z',
  'canvas.redo': 'Redo · ⇧⌘Z',
  'canvas.duplicate': 'Duplicate · ⌘D',
  'canvas.delete': 'Delete · ⌫',
  'canvas.resetLayout': 'Reset to starter layout',
  'canvas.blocks': 'Blocks',
  'canvas.properties': 'Properties',
  'canvas.nothingSelected': 'Nothing selected.',
  'canvas.nothingSelectedHint': 'Click a block on the canvas to edit its properties.',
  'canvas.noEditableProps': 'This block has no editable properties.',
  'canvas.undoAction': 'Undo',
  'canvas.redoAction': 'Redo',
  'canvas.duplicateSelected': 'Duplicate selected block',
  'canvas.deleteSelected': 'Delete selected block',
  'canvas.resetCanvas': 'Reset canvas',
  'canvas.openNewTab': 'Open this design in a new browser tab',
  'canvas.sendMessage': 'Send message',

  // ── Canvas property placeholders ──
  'prop.title': 'Title',
  'prop.meta': 'Meta, e.g. Due 2026-08-05',
  'prop.labelOptional': 'Label (optional)',
  'prop.placeholder': 'Placeholder',
  'prop.optionsComma': 'Options, comma separated',
  'prop.buttonLabel': 'Button label',

  // ── Terminal ──
  'terminal.attachImage': 'Attach an image',
  'terminal.attachFile': 'Attach a file',
  'terminal.stop': 'Stop (esc)',
  'terminal.stopResponse': 'Stop the response',
  'terminal.send': 'Send',
  'terminal.sendMessage': 'Send message',
  'terminal.claudeModel': 'Claude model',
  'terminal.attachImages': 'Attach images to this chat',
  'terminal.attachFiles': 'Attach files to this chat',
  'terminal.promptPlaceholder':
    'Ask Claude Code to solve it, e.g. "implement the date-range filter and show the tests"',

  // ── Research ──
  'research.searchChats': 'Search chats',
  'research.newFolder': 'New folder',
  'research.folderName': 'Folder name',
  'research.createFolder': 'Create new chat folder',
  'research.newChat': 'New chat in this folder',
  'research.deleteFolder': 'Delete this folder',
  'research.deleteChat': 'Delete this chat',

  // ── Task page ──
  'taskPage.generateDesign': 'Generate the html page and UI design for this task',
  'taskPage.editTask': 'Edit task',
  'taskPage.deleteTask': 'Delete task',
  'taskPage.closePanel': 'Close the task panel',
  'taskPage.unlinkTask': 'Unlink from this task',
  'taskPage.edit': 'Edit',
  'taskPage.delete': 'Delete',

  // ── Meeting page ──
  'meeting.moveToVersion': 'Move to design version',
  'meeting.closePreview': 'Close the file preview',
  'meeting.closePanel': 'Close the meeting panel',
  'meeting.generateDesigns': 'Generate designs',
  'meeting.pickVersion': 'Pick version',
  'meeting.nothingAttached': 'Nothing attached to this meeting.',

  // ── Board page ──
  'board.designFromScratch': 'Design from scratch or revise a screen',
  'board.maxScreens': 'Maximum screens to propose',
  'board.includeRefFiles': 'Include reference file text in the prompt',
  'board.selectMeeting': 'Select meeting',

  // ── Workspace page ──
  'workspace.nothingInFolder': 'Nothing in {name} yet.',

  // ── Builder ──
  'builder.searchMockups': 'Search by title, domain, screen, author',
  'builder.filterDomain': 'Filter by domain',
  'builder.filterAuthor': 'Filter by author',
  'builder.filterStatus': 'Filter by status',
  'builder.searchSpecs': 'Search by menu name, path, description',
  'builder.specStatus': 'Spec status',
  'builder.searchSolutions': 'Search by menu name, path, link',
  'builder.editSolution': 'Edit solution mockup',
  'builder.searchRequirements': 'Search by title, kind, planner, developer',

  // ── Production / Admin ──
  'production.search': 'Search by menu path or route',
  'security.search': 'Search by file, command, type',

  // ── Project home ──
  'home.claudeSpend': 'Claude spend on this project',

  // ── Sections ──
  'sections.businessSections': 'Business sections',
  'sections.layers': 'Layers',
};
