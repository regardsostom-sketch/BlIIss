-- Необязательно: пример программы A1 с одной темой, чтобы сразу увидеть, как всё выглядит.
-- Выполните после schema.sql. Редактировать её сможет админ (у программы нет владельца-преподавателя).
do $$
declare p uuid; t uuid; s1 uuid; s2 uuid;
begin
  insert into programs (level, title, title_kk, descr, published) values ('A1', 'English A1', 'English A1 (бастапқы деңгей)', 'Программа для начинающих', true) returning id into p;
  insert into topics (program_id, position, title, title_kk) values (p, 1, 'Знакомство', 'Танысу') returning id into t;
  insert into subtopics (topic_id, position, title, title_kk) values (t, 1, 'Приветствия и имена', 'Сәлемдесу және есімдер') returning id into s1;
  insert into subtopics (topic_id, position, title, title_kk) values (t, 2, 'Глагол to be', 'to be етістігі') returning id into s2;

  update sections set content = '{"explanation":"Глагол to be: I am, you are, he/she/it is, we/they are.","explanation_kk":"to be етістігі: I am, you are, he/she/it is, we/they are.","gaps":[{"text":"I ___ a student.","answer":"am"},{"text":"She ___ my teacher.","answer":"is"},{"text":"We ___ friends.","answer":"are"}]}'::jsonb
    where subtopic_id = s1 and kind = 'grammar';
  update sections set content = '{"words":[{"en":"hello","ru":"привет","kk":"сәлем"},{"en":"goodbye","ru":"до свидания","kk":"сау болыңыз"},{"en":"name","ru":"имя","kk":"есім"},{"en":"nice to meet you","ru":"приятно познакомиться","kk":"танысқаныма қуаныштымын"}]}'::jsonb
    where subtopic_id = s1 and kind = 'vocabulary';
  update sections set content = '{"text":"Hello. My name is Anna. Nice to meet you.","questions":[{"q":"What is her name?","options":["Anna","Maria","Olga"],"correct":0}]}'::jsonb
    where subtopic_id = s1 and kind = 'listening';
  update sections set content = '{"text":"Tom is a student. He is from London. He is twenty years old.","questions":[{"q":"Where is Tom from?","options":["London","Paris"],"correct":0},{"q":"How old is Tom?","options":["20","18","25"],"correct":0}]}'::jsonb
    where subtopic_id = s1 and kind = 'reading';
  update sections set content = '{"task":"Напишите 3 предложения о себе: имя, возраст, откуда вы.","task_kk":"Өзіңіз туралы 3 сөйлем жазыңыз: есіміңіз, жасыңыз, қайдансыз."}'::jsonb
    where subtopic_id = s1 and kind = 'writing';
  update sections set content = '{"task":"Запишите аудио: поздоровайтесь и представьтесь (15–20 секунд).","task_kk":"Аудио жазыңыз: сәлемдесіп, өзіңізді таныстырыңыз (15–20 секунд)."}'::jsonb
    where subtopic_id = s1 and kind = 'speaking';
  update sections set filled = true where subtopic_id = s1;
end $$;
