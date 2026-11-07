# Ассеты модуля и авторство

Все файлы лежат в модуле локально, интерфейс ничего не загружает из интернета. Значки интерфейса — Font Awesome из состава Foundry, модуль его не копирует и не распространяет.

## Шрифты (SIL OFL 1.1)

| Ассет | Автор | Источник | Файл в модуле | Где используется |
|---|---|---|---|---|
| Oswald | The Oswald Project Authors | [googlefonts/OswaldFont](https://github.com/googlefonts/OswaldFont), [копия Google Fonts, ревизия 8b0a1d0](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/oswald) | `assets/fonts/Oswald.ttf`, лицензия `assets/fonts/oswald-OFL.txt` | Вкладки, бренд, кнопки верхней панели |
| Roboto Condensed | The Roboto Project Authors | [googlefonts/roboto-classic](https://github.com/googlefonts/roboto-classic), [копия Google Fonts, ревизия 69d0549](https://github.com/google/fonts/tree/69d0549e8fc7ad72e1531734c81237be401ec4fd/ofl/robotocondensed) | `assets/fonts/RobotoCondensed.ttf`, лицензия `assets/fonts/robotocondensed-OFL.txt` | Подсказки и текст верхней панели |

Файлы шрифтов не изменены. Это те же копии, что и в модуле `night-city-menu`. В текстах лицензий переводы строк приведены к LF, как во всём репозитории, сам текст не менялся.

## Собственная графика (MIT, как код)

| Ассет | Автор | Файл в модуле | Где используется |
|---|---|---|---|
| Шестигранная сетка | Horusian, из модуля `night-city-menu` (генератор `tools/build_hud_decor.py` того репозитория) | `assets/decorations/hud-hex.svg` | Фактура верхней панели |
