/**
 * Notes: 设置管理
 * Ver : CCMiniCloud Framework 2.0.1 ALL RIGHTS RESERVED BY cclinux0730 (wechat)
 * Date: 2021-07-11 07:48:00 
 */

const BaseAdminService = require('./base_admin_service.js');
const cloudBase = require('../../../framework/cloud/cloud_base.js');
const cloudUtil = require('../../../framework/cloud/cloud_util.js');
const SetupModel = require('../../model/setup_model.js');
const config = require('../../../config/config.js');

class AdminSetupService extends BaseAdminService {


	/** 关于我们 */
	async setupAbout({
		about,
		aboutPic
	}) {

		let data = {
			SETUP_ABOUT: about,
			SETUP_ABOUT_PIC: aboutPic
		}
		await SetupModel.edit({}, data);
	}

	/** 联系我们设置 */
	async setupContact({
		address,
		phone,
		officePic,
		servicePic,
	}) {

		// 获取数据库里的图片数据
		let setup = await SetupModel.getOne({}, 'SETUP_OFFICE_PIC,SETUP_SERVICE_PIC');

		// 处理 新旧文件
		await cloudUtil.handlerCloudFiles(setup.SETUP_OFFICE_PIC, officePic);
		await cloudUtil.handlerCloudFiles(setup.SETUP_SERVICE_PIC, servicePic);


		let data = {
			SETUP_ADDRESS: address,
			SETUP_PHONE: phone,
			SETUP_OFFICE_PIC: officePic,
			SETUP_SERVICE_PIC: servicePic
		}
		console.log(data)
		await SetupModel.edit({}, data);
	}

	/** 小程序码 */
	async genMiniQr() {
		//生成小程序qr buffer
		let cloud = cloudBase.getCloud();

		let PID = this.getProjectId();
		let page = "projects/" + PID + "/default/index/default_index";
		console.log(page);

		let rd = PID;
		rd = rd.match(/\d+/g).join('');
		rd = Number(rd) % 20;

		let colorArr = [];
		colorArr.push('0 238 238');
		colorArr.push('47 79 79');
		colorArr.push('105 139 105');
		colorArr.push('119 136 153');
		colorArr.push('100 149 237');
		colorArr.push('0 205 0');
		colorArr.push('176 196 222');
		colorArr.push('205 190 112');
		colorArr.push('255 20 147');
		colorArr.push('139 90 0');
		colorArr.push('205 16 118');
		colorArr.push('255 174 185');
		colorArr.push('108 166 205');
		colorArr.push('0 0 139');
		colorArr.push('130 130 130');
		colorArr.push('205 150 205');
		colorArr.push('205 102 0');
		colorArr.push('139 101 8');
		colorArr.push('72 209 204');
		colorArr.push('176 196 222');
		let color = colorArr[rd].split(' ');

		let result = await cloud.openapi.wxacode.getUnlimited({
			scene: 'qr',
			width: 280,
			lineColor: {
				r: color[0],
				g: color[1],
				b: color[2],
			},
			check_path: false,
			env_version: 'release', //trial,develop
			page
		});

		let upload = await cloud.uploadFile({
			cloudPath: config.SETUP_PATH + PID + '_qr.png',
			fileContent: result.buffer,
		});

		if (!upload || !upload.fileID) return;

		return upload.fileID;
	}

}

module.exports = AdminSetupService;