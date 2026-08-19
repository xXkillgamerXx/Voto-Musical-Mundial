/// Cadenas del módulo de autenticación (login, registro, recuperación,
/// términos, gate/drawer). Namespace: `auth.`.
const Map<String, Map<String, String>> authStrings = {
  // Login
  'auth.loginTitle': {'es': 'Iniciar sesion', 'en': 'Log in', 'ko': '로그인'},
  'auth.loginSubtitle': {
    'es':
        'Inicia en tu cuenta para votar, recibir recompensas y seguir a tus artistas.',
    'en':
        'Sign in to your account to vote, earn rewards and follow your artists.',
    'ko': '투표하고 보상을 받고 좋아하는 아티스트를 팔로우하려면 계정에 로그인하세요.',
  },
  'auth.loginEnterEmailPassword': {
    'es': 'Escribe tu correo y contraseña.',
    'en': 'Enter your email and password.',
    'ko': '이메일과 비밀번호를 입력하세요.',
  },
  'auth.noAccountQuestion': {
    'es': 'No tienes cuenta?',
    'en': "Don't have an account?",
    'ko': '계정이 없으신가요?',
  },
  'auth.createAccount': {
    'es': 'Crear cuenta',
    'en': 'Create account',
    'ko': '계정 만들기',
  },
  'auth.emailOrUsernameLabel': {
    'es': 'Correo o usuario',
    'en': 'Email or username',
    'ko': '이메일 또는 사용자 이름',
  },
  'auth.emailOrUsernameHint': {
    'es': 'Correo o nombre de usuario',
    'en': 'Email or username',
    'ko': '이메일 또는 사용자 이름',
  },
  'auth.loginPasswordLabel': {
    'es': 'Contrasena',
    'en': 'Password',
    'ko': '비밀번호',
  },
  'auth.rememberPassword': {
    'es': 'Recordar contrasena',
    'en': 'Remember password',
    'ko': '비밀번호 기억하기',
  },
  'auth.forgotPasswordQuestion': {
    'es': 'Olvidaste tu contrasena?',
    'en': 'Forgot your password?',
    'ko': '비밀번호를 잊으셨나요?',
  },

  // Register
  'auth.registerSubtitle': {
    'es':
        'Crea tu cuenta fan para votar, recibir recompensas y seguir artistas.',
    'en': 'Create your fan account to vote, earn rewards and follow artists.',
    'ko': '투표하고 보상을 받고 아티스트를 팔로우할 팬 계정을 만드세요.',
  },
  'auth.registerIntro': {
    'es':
        'Completa tus datos básicos para votar, reclamar puntos y guardar tu progreso.',
    'en':
        'Fill in your basic details to vote, claim points and save your progress.',
    'ko': '투표하고 포인트를 받고 진행 상황을 저장할 수 있도록 기본 정보를 입력하세요.',
  },
  'auth.alreadyHaveAccount': {
    'es': 'Ya tengo cuenta',
    'en': 'I already have an account',
    'ko': '이미 계정이 있습니다',
  },
  'auth.stepProgress': {
    'es': 'Paso {current} de {total}',
    'en': 'Step {current} of {total}',
    'ko': '{total}단계 중 {current}단계',
  },
  'auth.enterFirstName': {
    'es': 'Escribe tu nombre.',
    'en': 'Enter your name.',
    'ko': '이름을 입력하세요.',
  },
  'auth.enterLastName': {
    'es': 'Escribe tu apellido.',
    'en': 'Enter your last name.',
    'ko': '성을 입력하세요.',
  },
  'auth.usernameRule': {
    'es': 'El username debe tener 3 a 20 caracteres: letras, números o _.',
    'en': 'The username must be 3 to 20 characters: letters, numbers or _.',
    'ko': '사용자 이름은 3~20자여야 합니다: 문자, 숫자 또는 _.',
  },
  'auth.enterEmail': {
    'es': 'Escribe tu correo.',
    'en': 'Enter your email.',
    'ko': '이메일을 입력하세요.',
  },
  'auth.selectCountry': {
    'es': 'Selecciona tu país.',
    'en': 'Select your country.',
    'ko': '국가를 선택하세요.',
  },
  'auth.selectCountryPlaceholder': {
    'es': 'Selecciona tu país',
    'en': 'Select your country',
    'ko': '국가를 선택하세요',
  },
  'auth.passwordMinLength': {
    'es': 'La contraseña debe tener al menos 8 caracteres.',
    'en': 'The password must be at least 8 characters.',
    'ko': '비밀번호는 최소 8자 이상이어야 합니다.',
  },
  'auth.passwordsDontMatch': {
    'es': 'Las contraseñas no coinciden.',
    'en': 'The passwords do not match.',
    'ko': '비밀번호가 일치하지 않습니다.',
  },
  'auth.mustAcceptTerms': {
    'es': 'Debes aceptar los términos y condiciones.',
    'en': 'You must accept the terms and conditions.',
    'ko': '이용약관에 동의해야 합니다.',
  },
  'auth.usernameLabel': {'es': 'Username', 'en': 'Username', 'ko': '사용자 이름'},
  'auth.usernameHint': {
    'es': 'nombre de usuario',
    'en': 'username',
    'ko': '사용자 이름',
  },
  'auth.firstNameLabel': {'es': 'Nombre', 'en': 'First name', 'ko': '이름'},
  'auth.firstNameHint': {
    'es': 'Tu nombre',
    'en': 'Your first name',
    'ko': '이름',
  },
  'auth.lastNameLabel': {'es': 'Apellido', 'en': 'Last name', 'ko': '성'},
  'auth.lastNameHint': {'es': 'Tu apellido', 'en': 'Your last name', 'ko': '성'},
  'auth.referralLabel': {
    'es': 'Código de invitación (opcional)',
    'en': 'Invite code (optional)',
    'ko': '초대 코드 (선택 사항)',
  },
  'auth.referralHint': {
    'es': 'Código de quien te invitó',
    'en': 'Code of who invited you',
    'ko': '초대한 사람의 코드',
  },
  'auth.referralDetected': {
    'es': 'Te invitó {code}. Ambos ganan puntos extra al registrarte.',
    'en': 'You were invited by {code}. You both earn extra points.',
    'ko': '{code}님이 초대했습니다. 두 사람 모두 추가 포인트를 받습니다.',
  },
  'auth.emailLabel': {'es': 'Correo', 'en': 'Email', 'ko': '이메일'},
  'auth.countryLabel': {
    'es': 'País donde vives',
    'en': 'Country where you live',
    'ko': '거주 국가',
  },
  'auth.phoneLabel': {
    'es': 'Teléfono (opcional)',
    'en': 'Phone (optional)',
    'ko': '전화번호 (선택 사항)',
  },
  'auth.searchCountry': {
    'es': 'Buscar país',
    'en': 'Search country',
    'ko': '국가 검색',
  },
  'auth.phoneHint': {'es': 'Tu número', 'en': 'Your number', 'ko': '전화번호'},
  'auth.phoneCountryTitle': {
    'es': 'Código del teléfono',
    'en': 'Phone code',
    'ko': '국가 번호',
  },
  'auth.passwordLabel': {'es': 'Contraseña', 'en': 'Password', 'ko': '비밀번호'},
  'auth.passwordMinHint': {
    'es': 'Mínimo 8 caracteres',
    'en': 'At least 8 characters',
    'ko': '최소 8자',
  },
  'auth.confirmPasswordLabel': {
    'es': 'Confirmar contraseña',
    'en': 'Confirm password',
    'ko': '비밀번호 확인',
  },
  'auth.confirmPasswordHint': {
    'es': 'Repite tu contraseña',
    'en': 'Repeat your password',
    'ko': '비밀번호를 다시 입력하세요',
  },
  'auth.acceptPrefix': {
    'es': 'Acepto los ',
    'en': 'I accept the ',
    'ko': '동의합니다: ',
  },
  'auth.termsLink': {
    'es': 'términos y condiciones',
    'en': 'terms and conditions',
    'ko': '이용약관',
  },
  'auth.next': {'es': 'Siguiente', 'en': 'Next', 'ko': '다음'},
  'auth.back': {'es': 'ATRÁS', 'en': 'BACK', 'ko': '뒤로'},

  // Forgot password
  'auth.forgotTitle': {
    'es': 'Recuperar contrasena',
    'en': 'Recover password',
    'ko': '비밀번호 찾기',
  },
  'auth.forgotSubtitle': {
    'es': 'Te enviaremos un enlace para volver a entrar a tu cuenta.',
    'en': "We'll send you a link to get back into your account.",
    'ko': '계정에 다시 접속할 수 있는 링크를 보내드립니다.',
  },
  'auth.emailFullHint': {
    'es': 'Correo electronico',
    'en': 'Email address',
    'ko': '이메일 주소',
  },
  'auth.sendLink': {'es': 'Enviar enlace', 'en': 'Send link', 'ko': '링크 보내기'},
  'auth.backToLogin': {
    'es': 'Volver a iniciar sesion',
    'en': 'Back to log in',
    'ko': '로그인으로 돌아가기',
  },
  'auth.resetPending': {
    'es':
        'Si hay una cuenta con ese correo, te enviaremos un enlace para recuperar tu contraseña.',
    'en':
        'If an account exists for that email, we will send you a link to recover your password.',
    'ko': '해당 이메일로 계정이 있으면 비밀번호를 재설정할 링크를 보내드립니다.',
  },

  // Terms & conditions
  'auth.termsTitle': {
    'es': 'Términos y condiciones',
    'en': 'Terms and conditions',
    'ko': '이용약관',
  },
  'auth.termsCard1Title': {
    'es': 'Uso responsable',
    'en': 'Responsible use',
    'ko': '책임감 있는 사용',
  },
  'auth.termsCard1Body': {
    'es':
        'Al crear una cuenta aceptas usar la plataforma de forma responsable y respetar las reglas de votación.',
    'en':
        'By creating an account you agree to use the platform responsibly and to respect the voting rules.',
    'ko': '계정을 만들면 플랫폼을 책임감 있게 사용하고 투표 규칙을 준수하는 데 동의하게 됩니다.',
  },
  'auth.termsCard2Title': {
    'es': 'Puntos y recompensas',
    'en': 'Points and rewards',
    'ko': '포인트와 보상',
  },
  'auth.termsCard2Body': {
    'es':
        'Los puntos, recompensas y rachas pueden ajustarse si se detecta abuso, fraude o actividad automática.',
    'en':
        'Points, rewards and streaks may be adjusted if abuse, fraud or automated activity is detected.',
    'ko': '악용, 부정 행위 또는 자동화된 활동이 감지되면 포인트, 보상, 연속 기록이 조정될 수 있습니다.',
  },
  'auth.termsCard3Title': {
    'es': 'Datos de cuenta',
    'en': 'Account data',
    'ko': '계정 데이터',
  },
  'auth.termsCard3Body': {
    'es':
        'Tu correo se usa para iniciar sesión, recuperar tu cuenta y guardar tu progreso dentro de la app.',
    'en':
        'Your email is used to sign in, recover your account and save your progress within the app.',
    'ko': '이메일은 로그인, 계정 복구 및 앱 내 진행 상황 저장에 사용됩니다.',
  },

  // Auth gate / drawer
  'auth.openMenu': {'es': 'Abrir menú', 'en': 'Open menu', 'ko': '메뉴 열기'},
  'auth.sectionPlaceholder': {
    'es': 'Esta sección se conectará como pantalla completa.',
    'en': 'This section will be connected as a full screen.',
    'ko': '이 섹션은 전체 화면으로 연결됩니다.',
  },
  'auth.signOut': {'es': 'Cerrar sesión', 'en': 'Sign out', 'ko': '로그아웃'},
  'auth.howToEarnPoints': {
    'es': 'Cómo generar puntos',
    'en': 'How to earn points',
    'ko': '포인트 얻는 방법',
  },
  'auth.signOutConfirm': {
    'es': '¿Seguro que quieres salir de tu cuenta?',
    'en': 'Are you sure you want to sign out of your account?',
    'ko': '계정에서 로그아웃하시겠습니까?',
  },
  'auth.cancel': {'es': 'Cancelar', 'en': 'Cancel', 'ko': '취소'},
  'auth.signOutYes': {'es': 'Sí, salir', 'en': 'Yes, sign out', 'ko': '네, 로그아웃'},
  'auth.languageToggle': {'es': 'English', 'en': 'Español', 'ko': '한국어'},

  // Shared auth controls
  'auth.continueWithGoogle': {
    'es': 'Continuar con Google',
    'en': 'Continue with Google',
    'ko': 'Google로 계속하기',
  },
  'auth.orDivider': {'es': 'o', 'en': 'or', 'ko': '또는'},

  // Brand
  'auth.brandTagline': {
    'es': 'AWARDS GLOBALES',
    'en': 'GLOBAL AWARDS',
    'ko': '글로벌 어워드',
  },
};
