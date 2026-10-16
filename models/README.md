# P0.4 黑金猫独立 GLB 模型

- `black-gold-cat-p04.glb`：原创、程序化生成的**分层3D角色原型**，不是电影级专业模型。
- GLB 2.0 / 内嵌网格和基础材质 / 无网络第三方依赖。
- 88 场景节点、68 个网格，包含可单独移动的头部、耳朵、四肢、眼睛与分段尾巴节点。
- `js/glb-loader.js` 当前支持单缓冲区三角形网格、节点层级、基础材质颜色；不支持 glTF蒙皮、动画片段、贴图采样、Draco 等扩展。
- `js/glb-renderer.js` 根据 `CatMind` 对部分具名节点实施独立变换。**这不是专业骨骼动画或 IK**。

## 未来高精度模型交付标准

专业 GLB 建议具备：独立猫科拓扑、正确 UV、PBR 毛发烘焙贴图、真实猫爪骨骼、分层尾骨、面部 blendshapes，以及 Idle/Walk/Sit/Loaf/Stand/Stretch/Purr/Greet 8 套动画。

注意：**不能直接覆盖现有 GLB 并假设所有专业骨骼模型都能播放**。在引入真正蒙皮与 PBR 材质后，必须升级播放器至完整 glTF 动画与材质系统，继续保留老模型回退。


P0.5：black-gold-cat-p05.glb 增加四条腿的 Knee（肘/跗关节）与眼睑节点，材质支持 roughnessFactor。仍是分层关节式模型，不是真正 skin 蒙皮。


P0.6: black-gold-cat-p06.glb — 114个场景节点、80个网格、11个颜色渐层网格。参阅 tools/build_cat_glb_p06.py 与 tools/add_vertex_coat.py；仍为刚性分层关节GLB（无skins）。
