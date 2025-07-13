# sound-visualization

## 📘 sound-visualization — 説明書（日本語）

### 🎯 概要
このプロジェクトは、`p5.js` および `p5.sound` を使用して、音声入力（マイク）から得られたスペクトル情報をもとに視覚的に描画するビジュアライゼーション作品です。

---

### 🧠 主な関数とその役割

#### preload()
- **役割**：リソースの事前読み込みに使用される関数（現在は空）。
- **備考**：`loadSound()` や `loadImage()` を使う場合に利用。

#### setup()
- **役割**：キャンバス、マイク、FFT解析、UIなどの初期化処理を行う。

#### draw()
- **役割**：毎フレーム呼び出され、音声スペクトルの各帯域に応じて視覚的な描画を行う。

#### initMic()
- **役割**：マイク入力とFFT（周波数解析）のセットアップを行う。

#### keyPressed()
- **役割**：
  - `Sキー`: SVG保存
  - `Cキー`: UIの表示／非表示切り替え
  - `Eキー`: キャンバスのリセット

---

### 🎨 各周波数帯域に対応した描画関数

| 関数名 | 周波数帯 | 表現内容 | 主な引数と調整項目 |
|--------|-----------|-----------|--------------------|
| `drawSubBassEnergy(subBassEnergy, time)` | 20〜60Hz（超低音） | 点のリング構造 | `subBassEnergy`: 点の大きさや密度に影響<br>`time`: 揺らぎ・回転演出に影響 |
| `drawLowEnergy(lowEnergy, frameCount, time)` | 60〜250Hz（低音） | 波打つ楕円形 | `lowEnergy`: 波の振幅に影響<br>`frameCount`: 回転スピードに影響<br>`time`: ゆらぎ制御 |
| `drawLowMidEnergy(lowMidEnergy, time)` | 250〜500Hz（低中音） | 彫刻的なリング形状 | `lowMidEnergy`: 曲線の厚みや振れ幅に影響<br>`time`: ノイズ変形制御 |
| `drawMidEnergy(midEnergy, frameCount, time)` | 500〜2000Hz（中音） | 回転する波形 | `midEnergy`: 放射角や波の強度に影響<br>`frameCount`: 回転制御<br>`time`: 位相の揺らぎ |
| `drawUpperMidEnergy(upperMidEnergy)` | 2000〜4000Hz（高中音） | 点描のようなエフェクト | `upperMidEnergy`: 点の数や広がりに影響 |
| `drawPresenceEnergy(presenceEnergy, frameCount)` | 4000〜6000Hz（存在感） | スパーク状の動き | `presenceEnergy`: スパーク数と長さに影響<br>`frameCount`: アニメーション制御 |
| `drawBrillianceEnergy(brillianceEnergy, time, frameCount)` | 6000〜16000Hz（輝き） | 光の線のような描画 | `brillianceEnergy`: 線の本数と明度に影響<br>`time`: 放射アニメーション制御<br>`frameCount`: 回転・周期の調整 |

---


---

### 🔧 引数と描画への影響（詳細）

#### `Energy` 系引数（例: `lowEnergy`, `midEnergy` など）
- FFTから得られる各帯域の音量（0〜255）。
- 変化量が大きいほど、動きや広がり、密度の調整に効果的。
- `map(energyValue, 0, 255, 0, 任意の最大値)` で正規化して使うと便利。

#### `frameCount`
- アニメーションのフレーム数。周期的な動きや回転制御に使用。
- `angle = frameCount * 回転係数` のように回転量のトリガーとして使われる。

#### `time`
- 一般的に `time = frameCount * 係数` として導出。
- `noise()` や `sin()` との組み合わせにより、ゆらぎや揺れを加える目的で使用。

#### 例：`drawLowEnergy()` 呼び出しの前処理
```javascript
let energyValue = lowEnergy;
let baseAmount = 12;
let intensity = map(energyValue, 0, 255, 0, 1);
let angle = frameCount * 0.02;
let dx = sin(angle + time) * baseAmount * intensity;
let dy = cos(angle + time * 1.5) * baseAmount * intensity;
translate(dx, dy);
drawLowEnergy(lowEnergy, frameCount, time);
```

- `intensity`: 音量に応じた影響度（0〜1）
- `dx`, `dy`: 波打つような揺らぎ位置を計算
- `translate(dx, dy)`: 全体の描画位置を時間変化に合わせて移動
- このように、**各引数は動き・位置・密度の制御パラメータ**として活用できる。

今後の開発では、各関数の引数に `baseAmount`, `intensityGain`, `angleSpeed` などの **UI連動スライダー**を接続することで、動的なビジュアライゼーション調整を行えるようにすることが推奨される。
