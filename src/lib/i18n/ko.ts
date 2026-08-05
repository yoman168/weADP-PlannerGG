export const ko: Record<string, string> = {
  // ── 글로벌 셸 ──
  'app.name': 'WE-ADK',
  'app.subtitle': '디자인 시스템',
  'nav.projects': '프로젝트',
  'nav.notifications': '알림',
  'nav.members': '멤버',
  'nav.archive': '보관',
  'nav.saveGitlab': 'GitLab에 저장 →',
  'nav.spend': '비용',
  'nav.spendOf': '${spend} / ${budget}',
  'nav.overBudget': '예산 초과: ${spend} 사용 / ${budget}',
  'nav.spentOf': '${spend} 사용 / ${budget}',
  'nav.mockupOnly': 'UI 목업 전용 — 실제 데이터 없음',

  // ── 도구 / 사이드바 ──
  'tool.business': '비즈니스',
  'tool.design': '디자인',
  'tool.developer': '개발자',
  'tool.qa': 'QA',

  // ── 스케쳐 탭 ──
  'tab.main': '메인',
  'tab.task': '작업',
  'tab.user': '초안',

  // ── 탐색기 ──
  'explorer.title': '탐색기',
  'explorer.newFile': '새 캔버스 파일',
  'explorer.newVersion': '다음 버전 시작',
  'explorer.collapse': '폴더 접기',
  'explorer.collapseAll': '모든 폴더 접기',
  'explorer.noVersions': '아직 버전이 없습니다.',
  'explorer.designCount': '{versions}개 버전에 {count}개 디자인',
  'explorer.noDesigns': '디자인 없음',
  'explorer.added': '이 라운드에서 추가됨',
  'explorer.modified': '이 라운드에서 변경됨',
  'explorer.modifiedCanvas': '이 라운드에서 캔버스가 변경됨',
  'explorer.modifiedLayout': '이 라운드에서 화면 레이아웃이 변경됨',
  'explorer.modifiedBoth': '이 라운드에서 캔버스와 레이아웃이 변경됨',
  'explorer.unchanged': '이전 라운드에서 이전됨, 변경 없음',
  'explorer.empty': '비어 있음',
  'explorer.addFile': '파일 추가',
  'explorer.carryOver': '릴리스된 디자인 가져오기',
  'explorer.baselineInfo':
    'version 1은 기준선입니다 — 제품이 라이브인 html 프로토타입, 아닌 경우 회의 디자인. 각 변경 라운드는 다음 버전을 생성합니다.',

  // ── 버전 상태 ──
  'status.released': '릴리스됨',
  'status.inProgress': '진행 중',
  'status.markAs': '{name}은(는) {status} — {next}(으)로 변경',
  'status.versionStatus': 'version {version}이(가) {status}입니다.',

  // ── 새 디자인 다이얼로그 ──
  'newDesign.title': '새 디자인 파일',
  'newDesign.name': '디자인 이름',
  'newDesign.namePlaceholder': '상환 시뮬레이션',
  'newDesign.version': '버전',
  'newDesign.route': '경로 (선택사항)',
  'newDesign.routePlaceholder': '/loan/apply/simulation',
  'newDesign.layout': '시작 레이아웃',
  'newDesign.create': '캔버스에서 생성 및 열기',
  'newDesign.listScreen': '목록 화면',
  'newDesign.detailScreen': '상세 / 입력 화면',
  'newDesign.dashboard': '대시보드',

  // ── 새 폴더 다이얼로그 ──
  'newFolder.title': '{name}에 새 폴더',
  'newFolder.label': '폴더 이름',
  'newFolder.placeholder': '승인 흐름',
  'newFolder.hint': '디자인 파일을 내부에 생성할 수 있으며, 라운드와 함께 이동합니다.',
  'newFolder.create': '폴더 생성',

  // ── 삭제 다이얼로그 ──
  'remove.folderTitle': '{name}을(를) 삭제하시겠습니까?',
  'remove.folderDesc':
    '이 폴더의 {count}개 디자인 파일이 함께 삭제됩니다. 나머지 라운드는 영향받지 않습니다.',
  'remove.versionTitle': '{name}을(를) 삭제하시겠습니까?',
  'remove.versionDesc':
    '이 라운드의 {count}개 디자인 파일이 함께 삭제됩니다. 기준선과 다른 버전은 영향받지 않습니다.',
  'remove.cancel': '취소',
  'remove.confirm': '{name} 삭제',

  // ── 플래시 메시지 ──
  'flash.saved': '{name} 저장됨 — 변경 표시가 초기화되었습니다.',
  'flash.deleted': '{name}이(가) 삭제되었습니다.',
  'flash.moved': '{name}을(를) {folder}(으)로 이동했습니다.',
  'flash.removed': '{name}이(가) 제거되었습니다.',
  'flash.cloned': 'version {version}이(가) version {from}에서 시작 — {count}개 디자인 이전됨.',
  'flash.clonedFolders':
    'version {version}이(가) version {from}에서 시작 — 폴더 {folders}개, 디자인 {count}개 이전됨.',
  'flash.upToDate': '{name}은(는) 이미 version {version}과 최신 상태입니다.',
  'flash.carriedOver': 'version {from}에서 {count}개 디자인이 이전되었습니다.',
  'flash.carriedOverFolders':
    'version {from}에서 폴더 {folders}개, 디자인 {count}개가 이전되었습니다.',
  'flash.folderCreated': '{parent}에 {name} 폴더가 생성되었습니다.',
  'flash.stillInProgress': 'version {version}이(가) 아직 진행 중입니다 — 먼저 릴리스하세요.',
  'flash.roundReleased': '{name}은(는) 릴리스되었습니다 — 변경하려면 다시 진행 중으로 전환하세요.',

  // ── 파일 액션 ──
  'file.edit': '{name} 편집',
  'file.save': '저장',
  'file.saveRound': '{name}을(를) 저장 상태로 표시 — A와 M 표시를 초기화합니다',
  'file.editCanvas': '{name}을(를) 캔버스에서 편집',
  'file.preview': '{name} 미리보기',
  'file.previewBrowser': '{name}을(를) 새 브라우저 탭에서 미리보기',
  'file.delete': '{name} 삭제',
  'file.readOnly': '읽기 전용 기준선',
  'file.releasedReadOnly': '(릴리스됨 — 읽기 전용)',
  'file.liveScreen': '라이브 화면 미리보기',

  // ── 미리보기 / 편집 ──
  'view.preview': '미리보기',
  'view.edit': '편집',
  'view.openBrowser': '브라우저에서 열기',

  // ── 배지 ──
  'badge.html': 'html',
  'badge.liveScreen': '라이브 화면',
  'badge.wireframe': '와이어프레임',
  'badge.localCli': '로컬 CLI',

  // ── Claude Code 채팅 ──
  'chat.claudeCode': 'Claude Code',
  'chat.askAbout': '{name}에 대해 질문하기',
  'chat.greetingHint': '미리보기 중인 화면의 레이아웃과 파일이 컨텍스트에 포함되어 있습니다.',
  'chat.pickFile': '탐색기에서 디자인 파일을 선택하여 미리보기하세요.',

  // ── 플로팅 액션 바 ──
  'action.improveAi': 'AI로 개선',
  'action.createTask': '작업 생성',

  // ── 미리보기 페이지 ──
  'preview.prototypeHint': '{summary} · UI 편집은 이 화면을 변경합니다; 편집은 캔버스를 엽니다.',
  'preview.releasedHint':
    '이 라운드는 릴리스되어 읽기 전용입니다 — 변경하려면 진행 중으로 표시하세요.',
  'preview.liveHint':
    '이 파일은 이미 라이브인 화면을 나타냅니다 — 미리보기는 실제 페이지를 마운트하므로 필터와 검색이 제품에서와 동일하게 작동합니다.',
  'preview.wireframeHint':
    '아직 이 파일 뒤에 라이브 화면이 없으므로 미리보기는 캔버스에 그려진 블록을 표시합니다.',
  'preview.notInVersion': '· 이 버전에 없음 —',

  // ── 사용자 탭 ──
  'user.team': '팀',
  'user.addMember': '멤버 추가',
  'user.editMember': '멤버 편집',
  'user.selectMember': '팀 멤버를 선택하세요.',
  'user.selectMemberHint':
    '디자인 작업 공간을 탐색하세요 — 각 멤버는 버전 파일의 독립적인 사본을 가지고 있습니다.',
  'user.selectFile': '디자인 파일을 선택하세요.',
  'user.selectFileHint': '{name}의 트리에서 파일을 선택하여 세부 정보를 보거나 캔버스에서 여세요.',
  'user.noMembers': '아직 팀 멤버가 없습니다.',
  'user.memberRemoved': '멤버가 제거되었습니다.',
  'user.memberAdded': '{name}이(가) 추가되었습니다.',
  'user.memberUpdated': '{name}이(가) 업데이트되었습니다.',
  'user.files': '{count}개 파일',
  'user.projectNotFound': '해당 프로젝트가 존재하지 않습니다.',
  'user.loadingTeam': '팀 로딩 중…',
  'user.designCount': '{versions}개 버전에 {count}개 디자인',

  // ── 멤버 폼 ──
  'member.name': '이름',
  'member.namePlaceholder': '전체 이름',
  'member.role': '역할',
  'member.email': '이메일',
  'member.emailPlaceholder': 'name@company.com',
  'member.department': '부서',
  'member.departmentPlaceholder': '엔지니어링, 디자인, 제품…',
  'member.save': '변경사항 저장',
  'member.add': '멤버 추가',
  'member.edit': '편집',
  'member.remove': '삭제',

  // ── 역할 ──
  'role.projectLead': '프로젝트 리드',
  'role.developer': '개발자',
  'role.designer': '디자이너',
  'role.qa': 'QA',
  'role.pm': 'PM',
  'role.other': '기타',

  // ── 캔버스 편집기 ──
  'canvas.empty': '이 캔버스는 비어 있습니다',
  'canvas.emptyHint': '왼쪽에서 블록을 드래그하거나 클릭하여 추가하세요.',
  'canvas.startList': '목록 페이지 패턴으로 시작',
  'canvas.helpText':
    '블록 선택 클릭 · 핸들 드래그로 정렬 · ⌘Z 실행취소 · ⌘D 복제 · ⌫ 삭제 · ⌥↑/↓ 이동',
  'canvas.loading': '캔버스 로딩 중…',

  // ── 채팅 ──
  'chat.placeholder': '메시지를 입력하세요...',
  'chat.attachFiles': '파일 첨부',
  'chat.attachFilesHint': '파일 첨부 — 이미지는 모델이 읽고, 텍스트는 프롬프트에 포함됩니다',
  'chat.maxAttachments': '메시지당 최대 {max}개 파일',
  'chat.model': '모델',
  'chat.dictateStart': '메시지 음성 입력',
  'chat.dictateStop': '음성 입력 중지',
  'chat.dictateUnavailable': '이 브라우저에서는 음성 입력을 사용할 수 없습니다',
  'chat.stopReply': '응답 중지',
  'chat.send': '전송',
  'chat.readAloud': '마지막 응답 읽기',
  'chat.stopReading': '읽기 중지',
  'chat.readUnavailable': '이 브라우저에서는 음성 읽기를 사용할 수 없습니다',
  'chat.nothingToRead': '아직 읽을 내용이 없습니다',
  'chat.disclaimer': 'Claude는 AI이며 실수할 수 있습니다. 인용된 출처를 다시 확인하세요.',

  // ── 라이브 미리보기 ──
  'live.editMode': '편집 모드',
  'live.done': '완료',
  'live.editUi': 'UI 편집',
  'live.noLiveScreen': '이 디자인에는 아직 라이브 화면이 없습니다.',
  'live.resetEdits': '이 파일의 편집 내용 삭제',

  // ── 목업 보드 ──
  'board.variant': '변형',
  'board.blocks': '블록',
  'board.loading': '로딩 중…',
  'board.emptyScreen': '빈 화면',
  'board.openCanvas': '캔버스에서 열기',
  'board.fromProduction': '프로덕션에서 · ',
  'board.variantOf': '변형: ',
  'board.noScreens': '아직 화면이 없습니다.',
  'board.footnote': '모든 프레임은 라이브 캔버스입니다 — 클릭하여 편집하면 여기에 반영됩니다.',

  // ── 작업 폼 ──
  'task.editTask': '작업 편집',
  'task.newTask': '새 작업',
  'task.title': '제목',
  'task.titlePlaceholder': '페이지 나누기 문제 수정…',
  'task.status': '상태',
  'task.priority': '우선순위',
  'task.category': '카테고리',
  'task.categoryPlaceholder': '이 작업은 무엇에 관한 것입니까?',
  'task.assignee': '담당자',
  'task.assigneePlaceholder': '이름',
  'task.description': '설명',
  'task.descriptionPlaceholder': '상세 컨텍스트…',
  'task.tags': '태그 (쉼표로 구분)',
  'task.tagsPlaceholder': '버그, 결제',
  'task.saveChanges': '변경사항 저장',
  'task.create': '작업 생성',

  // ── 작업 댓글 ──
  'comments.like': '좋아요',
  'comments.deleteComment': '이 댓글 삭제',
  'comments.pin': '스레드 상단에 고정',
  'comments.unpin': '고정 해제',
  'comments.all': '전체',
  'comments.comment': '댓글',
  'comments.noComments': '아직 댓글이 없습니다 — 아래에 작성하세요.',
  'comments.noActivity': '이 작업에 아직 활동이 없습니다.',
  'comments.writeComment': '이 작업에 댓글 작성',
  'comments.placeholder': 'Enter로 게시, Shift+Enter로 줄 바꿈',
  'comments.attachHint': '파일 첨부 — 댓글에 파일명이 기록됩니다',
  'comments.maxAttachments': '댓글당 최대 {max}개 파일',
  'comments.post': '댓글 게시',

  // ── 작업 생성 ──
  'generate.title': '이 작업의 화면 생성',
  'generate.charsDesc': '글자 설명',
  'generate.noDesc': '설명 없음',
  'generate.file': '파일',
  'generate.files': '파일',
  'generate.textFrom': '텍스트: ',
  'generate.screensToPropose': '제안할 화면',
  'generate.readAttached': '첨부 파일 읽기',
  'generate.longFilesTrimmed': '· 긴 파일은 잘립니다',
  'generate.done': '완료.',
  'generate.samplesHint':
    '이 작업에 저장된 샘플. 이동할 위치를 선택한 다음 원하는 항목을 메인 탭의 탐색기로 이동하세요.',
  'generate.proposedScreen': '제안된 화면',
  'generate.screens': '화면',
  'generate.editDesign': '디자인 편집',
  'generate.preview': '미리보기',
  'generate.openHtml': 'html 열기',
  'generate.drawing': 'Claude Code가 화면을 그리고 있습니다… ',
  'generate.drawingHint':
    '로컬 Claude Code CLI를 실행합니다 — 프롬프트 외에는 이 컴퓨터를 떠나지 않습니다.',
  'generate.generating': '생성 중',

  // ── 프로젝트 홈 ──
  'home.title': '내 프로젝트',
  'home.subtitle':
    '고객 대화를 버전별 프로젝트 브리프, 화면 및 클릭 가능한 프로토타입으로 전환 — 모든 디자인 파일은 해당 프로젝트에 보관됩니다.',
  'home.newProject': '새 프로젝트',
  'home.newProjectHint': '프로젝트 생성은 이 목업의 일부가 아닙니다 — 아래 샘플 중 하나를 여세요.',
  'home.search': '프로젝트 검색',
  'home.noArchived': '아직 보관된 항목이 없습니다.',
  'home.noMatch': '검색과 일치하는 프로젝트가 없습니다.',

  // ── 프로젝트 크롬 ──
  'project.savedGitlab': 'GitLab에 저장됨',
  'project.committed': 'GitLab에 커밋됨',
  'project.notCommitted': '아직 커밋되지 않음',

  // ── 참조 파일 ──
  'files.referenceFiles': '참조 파일',
  'files.attach': '첨부',
  'files.attachRef': '이 회의에 참조 파일 첨부',
  'files.noAttached':
    '아직 첨부된 파일이 없습니다 — 고객의 스프레드시트, 화이트보드 사진 또는 통화 녹음을 추가하세요.',
  'files.closePreview': '미리보기 닫기',
  'files.noPreview': '이 파일 유형에 대한 미리보기를 사용할 수 없습니다.',
  'files.new': '새로운',
  'files.preview': '미리보기',
  'files.removeFile': '이 참조 삭제',
  'files.moreFiles': '+{count}개 더',

  // ── 기타 ──
  'misc.nothingInFolder': '아직 {name}에 아무것도 없습니다.',
  'misc.nothingAttached': '이 회의에 첨부된 파일이 없습니다.',
  'misc.copyCode': '코드 복사',
  'misc.dragToReorder': '드래그하여 레이어 정렬',
  'misc.clickToSelect': '클릭하여 선택 · 더블클릭하여 이름 변경',
  'misc.showBlock': '블록 표시',
  'misc.hideBlock': '블록 숨기기',
  'misc.deleteBlock': '블록 삭제',
  'misc.duplicateBlock': '블록 복제',
  'misc.moveUp': '위로 이동',
  'misc.moveDown': '아래로 이동',
  'misc.remove': '삭제',
  'misc.toggleVisibility': '표시/숨기기 전환',
  'misc.notMockup': '이 목업의 일부가 아닙니다',

  // ── 캔버스 도구 모음 ──
  'canvas.undo': '실행취소 · ⌘Z',
  'canvas.redo': '다시 실행 · ⇧⌘Z',
  'canvas.duplicate': '복제 · ⌘D',
  'canvas.delete': '삭제 · ⌫',
  'canvas.resetLayout': '시작 레이아웃으로 초기화',
  'canvas.blocks': '블록',
  'canvas.properties': '속성',
  'canvas.nothingSelected': '선택된 항목이 없습니다.',
  'canvas.nothingSelectedHint': '캔버스에서 블록을 클릭하여 속성을 편집하세요.',
  'canvas.noEditableProps': '이 블록에는 편집 가능한 속성이 없습니다.',
  'canvas.undoAction': '실행취소',
  'canvas.redoAction': '다시 실행',
  'canvas.duplicateSelected': '선택된 블록 복제',
  'canvas.deleteSelected': '선택된 블록 삭제',
  'canvas.resetCanvas': '캔버스 초기화',
  'canvas.openNewTab': '새 브라우저 탭에서 이 디자인 열기',
  'canvas.sendMessage': '메시지 전송',

  // ── 캔버스 속성 플레이스홀더 ──
  'prop.title': '제목',
  'prop.meta': '메타, 예: 마감 2026-08-05',
  'prop.labelOptional': '레이블 (선택사항)',
  'prop.placeholder': '플레이스홀더',
  'prop.optionsComma': '옵션, 쉼표로 구분',
  'prop.buttonLabel': '버튼 레이블',

  // ── 터미널 ──
  'terminal.attachImage': '이미지 첨부',
  'terminal.attachFile': '파일 첨부',
  'terminal.stop': '중지 (esc)',
  'terminal.stopResponse': '응답 중지',
  'terminal.send': '전송',
  'terminal.sendMessage': '메시지 전송',
  'terminal.claudeModel': 'Claude 모델',
  'terminal.attachImages': '이 채팅에 이미지 첨부',
  'terminal.attachFiles': '이 채팅에 파일 첨부',
  'terminal.promptPlaceholder':
    'Claude Code에 요청하세요, 예: "날짜 범위 필터를 구현하고 테스트를 보여주세요"',

  // ── 리서치 ──
  'research.searchChats': '채팅 검색',
  'research.newFolder': '새 폴더',
  'research.folderName': '폴더 이름',
  'research.createFolder': '새 채팅 폴더 생성',
  'research.newChat': '이 폴더에 새 채팅',
  'research.deleteFolder': '이 폴더 삭제',
  'research.deleteChat': '이 채팅 삭제',

  // ── 작업 페이지 ──
  'taskPage.generateDesign': '이 작업의 html 페이지 및 UI 디자인 생성',
  'taskPage.editTask': '작업 편집',
  'taskPage.deleteTask': '작업 삭제',
  'taskPage.closePanel': '작업 패널 닫기',
  'taskPage.unlinkTask': '이 작업에서 연결 해제',
  'taskPage.edit': '편집',
  'taskPage.delete': '삭제',

  // ── 회의 페이지 ──
  'meeting.moveToVersion': '디자인 버전으로 이동',
  'meeting.closePreview': '파일 미리보기 닫기',
  'meeting.closePanel': '회의 패널 닫기',
  'meeting.generateDesigns': '디자인 생성',
  'meeting.pickVersion': '버전 선택',
  'meeting.nothingAttached': '이 회의에 첨부된 파일이 없습니다.',

  // ── 보드 페이지 ──
  'board.designFromScratch': '처음부터 디자인하거나 화면 수정',
  'board.maxScreens': '제안할 최대 화면 수',
  'board.includeRefFiles': '프롬프트에 참조 파일 텍스트 포함',
  'board.selectMeeting': '회의 선택',

  // ── 워크스페이스 페이지 ──
  'workspace.nothingInFolder': '아직 {name}에 아무것도 없습니다.',

  // ── 빌더 ──
  'builder.searchMockups': '제목, 도메인, 화면, 작성자로 검색',
  'builder.filterDomain': '도메인별 필터',
  'builder.filterAuthor': '작성자별 필터',
  'builder.filterStatus': '상태별 필터',
  'builder.searchSpecs': '메뉴명, 경로, 설명으로 검색',
  'builder.specStatus': '스펙 상태',
  'builder.searchSolutions': '메뉴명, 경로, 링크로 검색',
  'builder.editSolution': '솔루션 목업 편집',
  'builder.searchRequirements': '제목, 종류, 기획자, 개발자로 검색',

  // ── 프로덕션 / 관리 ──
  'production.search': '메뉴 경로 또는 라우트로 검색',
  'security.search': '파일, 명령어, 유형으로 검색',

  // ── 프로젝트 홈 ──
  'home.claudeSpend': '이 프로젝트의 Claude 비용',

  // ── 섹션 ──
  'sections.businessSections': '비즈니스 섹션',
  'sections.layers': '레이어',
};
